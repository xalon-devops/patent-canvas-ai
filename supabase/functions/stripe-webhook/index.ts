import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { findCustomerIds, syncUserSubscription } from "../_shared/stripe-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

/*
 * Idempotency / ordering strategy (no events table required):
 * - Subscription state is never taken from the event payload; we re-read the customer's
 *   live subscriptions from Stripe and reconcile (syncUserSubscription). Duplicate or
 *   out-of-order deliveries therefore converge on Stripe's current state.
 * - application_payments only moves forward (pending -> completed -> refunded); updates
 *   are guarded with status filters so a replayed event cannot downgrade a row.
 * - Emails are de-duplicated via email_notifications.stripe_session_id + email_type.
 * - Processing errors return 500 so Stripe retries; signature failures return 400.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    // Never process unsigned events: this endpoint is public (verify_jwt=false).
    logStep("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET - refusing event");
    return json({ error: "Webhook not configured" }, 500);
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing Stripe signature" }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    logStep("Webhook signature verification failed", { error: errMessage });
    return json({ error: `Webhook signature verification failed: ${errMessage}` }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  /** Send an email at most once per (stripe session, email_type). */
  const sendEmailOnce = async (
    loggedEmailType: string,
    stripeSessionId: string,
    payload: Record<string, unknown>,
  ) => {
    const { data: already } = await supabase
      .from("email_notifications")
      .select("id")
      .eq("stripe_session_id", stripeSessionId)
      .eq("email_type", loggedEmailType)
      .limit(1);
    if (already && already.length > 0) {
      logStep("Email already sent for session, skipping", { loggedEmailType, stripeSessionId });
      return;
    }
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ ...payload, stripeSessionId }),
      });
    } catch (err) {
      logStep("Error sending email", { loggedEmailType, error: String(err) });
    }
  };

  /** Resolve our user id for a Stripe customer / subscription. */
  const resolveUserId = async (
    metadataUserId: string | undefined | null,
    customerId: string | null,
    stripeSubscriptionId?: string | null,
  ): Promise<string | null> => {
    if (metadataUserId) return metadataUserId;
    if (stripeSubscriptionId) {
      const { data } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .maybeSingle();
      if (data?.user_id) return data.user_id;
    }
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (!("deleted" in customer && customer.deleted)) {
          const uid = (customer as Stripe.Customer).metadata?.user_id;
          if (uid) return uid;
        }
      } catch (_e) { /* ignore */ }
    }
    return null;
  };

  const customerEmail = async (customerId: string | null): Promise<string | null> => {
    if (!customerId) return null;
    try {
      const c = await stripe.customers.retrieve(customerId);
      if ("deleted" in c && c.deleted) return null;
      return (c as Stripe.Customer).email ?? null;
    } catch (_e) {
      return null;
    }
  };

  const syncForCustomer = async (userId: string, customerId: string | null) => {
    const ids = await findCustomerIds(stripe, await customerEmail(customerId), customerId);
    const result = await syncUserSubscription(stripe, supabase, userId, ids);
    logStep("Subscription reconciled", { userId, plan: result.plan, status: result.status, skipped: result.skipped });
    return result;
  };

  const idOf = (v: string | { id: string } | null | undefined): string | null =>
    !v ? null : typeof v === "string" ? v : v.id;

  /** Mark a one-time application payment as paid (forward-only) and email once. */
  const completeApplicationPayment = async (session: Stripe.Checkout.Session) => {
    const applicationId = session.metadata?.application_id;
    const userId = session.metadata?.user_id;
    if (!applicationId || !userId) {
      logStep("Payment session missing metadata", { sessionId: session.id });
      return;
    }
    const paymentIntentId = idOf(session.payment_intent as any);
    const row = {
      user_id: userId,
      stripe_session_id: session.id,
      stripe_payment_id: paymentIntentId,
      amount: session.amount_total ?? 100000,
      currency: session.currency || "usd",
      status: "completed",
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updErr } = await supabase
      .from("application_payments")
      .update(row)
      .eq("application_id", applicationId)
      .neq("status", "completed")
      .select("id");
    if (updErr) throw updErr;

    if (!updated || updated.length === 0) {
      const { data: existing } = await supabase
        .from("application_payments")
        .select("id")
        .eq("application_id", applicationId)
        .maybeSingle();
      if (!existing) {
        const { error: insErr } = await supabase
          .from("application_payments")
          .insert({ ...row, application_id: applicationId });
        // 23505 = concurrent insert by verify-payment; that path also marks it completed.
        if (insErr && (insErr as { code?: string }).code !== "23505") throw insErr;
      }
    }

    await supabase
      .from("patent_sessions")
      .update({ status: "completed" })
      .eq("id", applicationId)
      .not("status", "in", "(filed,completed)");

    await sendEmailOnce("payment_received", session.id, {
      type: "payment_received",
      userId,
      sessionId: applicationId,
      amount: session.amount_total,
      paymentType: "patent_application",
    });
  };

  /** Forward-only status update of the pending payment_transactions row for a session. */
  const updateTransaction = async (session: Stripe.Checkout.Session, status: string) => {
    const patch: Record<string, unknown> = {
      status,
      stripe_payment_intent_id: idOf(session.payment_intent as any),
      updated_at: new Date().toISOString(),
    };
    if (typeof session.amount_total === "number") patch.amount = session.amount_total; // $0 for trials
    // 'completed' may replace pending/failed/expired; anything else only replaces 'pending'.
    let q = supabase.from("payment_transactions").update(patch).eq("stripe_session_id", session.id);
    q = status === "completed" ? q.not("status", "in", "(completed,refunded)") : q.eq("status", "pending");
    const { error } = await q;
    if (error) logStep("Error updating payment transaction", { error });
  };

  try {
    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.app && session.metadata.app !== "patentbot") break;
        const paidOrFree = session.payment_status === "paid" || session.payment_status === "no_payment_required";
        logStep("Checkout session", { sessionId: session.id, mode: session.mode, payment_status: session.payment_status });

        await updateTransaction(session, paidOrFree ? "completed" : "pending");

        if (session.mode === "subscription") {
          const userId = await resolveUserId(session.metadata?.user_id, idOf(session.customer as any), idOf(session.subscription as any));
          if (!userId) {
            logStep("Could not resolve user for subscription session", { sessionId: session.id });
            break;
          }
          const result = await syncForCustomer(userId, idOf(session.customer as any));
          if (result.subscribed && event.type === "checkout.session.completed") {
            await sendEmailOnce("subscription_update", session.id, {
              type: "subscription_welcome",
              userId,
              planType: session.metadata?.plan_type === "trademark_suite" ? "Trademark Suite" : "Check & See",
              amount: session.amount_total,
            });
          }
        } else if (session.mode === "payment") {
          // Async methods (ACH etc.) complete with payment_status 'unpaid'; wait for async_payment_succeeded.
          if (session.payment_status === "paid") {
            await completeApplicationPayment(session);
          } else {
            logStep("Payment not yet paid - awaiting async confirmation", { sessionId: session.id });
          }
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await updateTransaction(session, "failed");
        if (session.mode === "payment" && session.metadata?.application_id) {
          await supabase
            .from("application_payments")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("application_id", session.metadata.application_id)
            .eq("stripe_session_id", session.id)
            .eq("status", "pending");
        }
        if (session.mode === "subscription") {
          const userId = await resolveUserId(session.metadata?.user_id, idOf(session.customer as any), idOf(session.subscription as any));
          if (userId) await syncForCustomer(userId, idOf(session.customer as any));
        }
        break;
      }

      case "checkout.session.expired": {
        const expiredSession = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session expired (abandoned)", { sessionId: expiredSession.id });
        await updateTransaction(expiredSession, "expired");

        // Safety switch: abandoned checkout emails are OFF unless explicitly enabled.
        if (Deno.env.get("ABANDONED_CHECKOUT_EMAILS_ENABLED") !== "true") break;
        if (!expiredSession.customer_email && !expiredSession.metadata?.user_id) break;

        // send-email also enforces a unique (stripe_session_id) claim for this type.
        await sendEmailOnce("abandoned_checkout", expiredSession.id, {
          type: "abandoned_checkout",
          userId: expiredSession.metadata?.user_id,
          userEmail: expiredSession.customer_email,
          sessionMode: expiredSession.mode,
          amountTotal: expiredSession.amount_total,
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = idOf(subscription.customer as any);
        const userId = await resolveUserId(subscription.metadata?.user_id, customerId, subscription.id);
        if (!userId) {
          logStep("No user for subscription event", { subId: subscription.id });
          break;
        }
        await syncForCustomer(userId, customerId);
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
      case "invoice.payment_action_required": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = idOf(invoice.subscription as any);
        if (!subId) break;
        const customerId = idOf(invoice.customer as any);
        const userId = await resolveUserId(
          (invoice as any).subscription_details?.metadata?.user_id,
          customerId,
          subId,
        );
        if (!userId) break;
        // Stripe moves the subscription to past_due/unpaid itself; mirror its live state.
        await syncForCustomer(userId, customerId);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = idOf(charge.payment_intent as any);
        if (!paymentIntentId || !charge.refunded) break; // only full refunds revoke access
        const { error } = await supabase
          .from("application_payments")
          .update({ status: "refunded", updated_at: new Date().toISOString() })
          .eq("stripe_payment_id", paymentIntentId);
        if (error) throw error;
        await supabase
          .from("payment_transactions")
          .update({ status: "refunded", updated_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", paymentIntentId);
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return json({ received: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage, eventId: event.id });
    // 500 => Stripe retries with backoff; handlers are idempotent.
    return json({ error: errorMessage }, 500);
  }
});
