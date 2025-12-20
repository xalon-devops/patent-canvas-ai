import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(stripeKey, { 
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });
    
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logStep("Missing stripe-signature header");
      throw new Error("Missing Stripe signature");
    }

    // Verify webhook signature
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    let event: Stripe.Event;

    if (webhookSecret) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        logStep("Webhook signature verification failed", { error: errMessage });
        return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${errMessage}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    } else {
      event = JSON.parse(body) as Stripe.Event;
      logStep("WARNING: Webhook signature not verified - set STRIPE_WEBHOOK_SECRET in production");
    }

    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { sessionId: session.id });

        // Update payment transaction
        const { error: updateError } = await supabaseClient
          .from("payment_transactions")
          .update({ 
            status: "completed",
            stripe_payment_intent_id: session.payment_intent,
            updated_at: new Date().toISOString()
          })
          .eq("stripe_session_id", session.id);

        if (updateError) {
          logStep("Error updating payment transaction", { error: updateError });
        }

        // Handle subscription payment (Check & See)
        if (session.mode === "subscription" && session.metadata?.user_id) {
          const userId = session.metadata.user_id;
          const planType = session.metadata.plan_type || "check_and_see";

          const { error: subError } = await supabaseClient
            .from("subscriptions")
            .upsert({
              user_id: userId,
              status: "active",
              plan: planType,
              stripe_subscription_id: session.subscription,
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

          if (subError) {
            logStep("Error updating subscription", { error: subError });
          } else {
            logStep("Subscription updated successfully", { userId, planType });
          }
        }

        // Handle one-time payment (Patent Application)
        if (session.mode === "payment" && session.metadata?.application_id) {
          const { error: appPaymentError } = await supabaseClient
            .from("application_payments")
            .update({
              status: "completed",
              stripe_payment_id: session.payment_intent,
              updated_at: new Date().toISOString()
            })
            .eq("stripe_session_id", session.id);

          if (appPaymentError) {
            logStep("Error updating application payment", { error: appPaymentError });
          } else {
            logStep("Application payment completed", { applicationId: session.metadata.application_id });
            
            // Send payment confirmation email (fire and forget)
            fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                type: "payment_received",
                userId: session.metadata.user_id,
                sessionId: session.metadata.application_id,
                amount: session.amount_total,
                paymentType: "patent_application",
              }),
            }).catch(err => logStep("Error sending payment email", { error: err }));
          }
        }

        // Send subscription welcome email for new subscriptions
        if (session.mode === "subscription" && session.metadata?.user_id) {
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              type: "subscription_welcome",
              userId: session.metadata.user_id,
              planType: "Check & See",
              amount: session.amount_total,
            }),
          }).catch(err => logStep("Error sending subscription email", { error: err }));
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": 
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription event", { type: event.type, subId: subscription.id });

        // Find user by stripe subscription ID
        const { data: existingSub } = await supabaseClient
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (existingSub) {
          const newStatus = event.type === "customer.subscription.deleted" ? "cancelled" : subscription.status;
          
          const { error: updateError } = await supabaseClient
            .from("subscriptions")
            .update({ 
              status: newStatus,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("stripe_subscription_id", subscription.id);

          if (updateError) {
            logStep("Error updating subscription status", { error: updateError });
          } else {
            logStep("Subscription status updated", { status: newStatus });
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment succeeded", { invoiceId: invoice.id, subscriptionId: invoice.subscription });
        
        if (invoice.subscription) {
          const { error } = await supabaseClient
            .from("subscriptions")
            .update({ 
              status: "active",
              updated_at: new Date().toISOString()
            })
            .eq("stripe_subscription_id", invoice.subscription);
          
          if (error) {
            logStep("Error updating subscription on invoice success", { error });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment failed", { invoiceId: invoice.id, subscriptionId: invoice.subscription });
        
        if (invoice.subscription) {
          const { error } = await supabaseClient
            .from("subscriptions")
            .update({ 
              status: "past_due",
              updated_at: new Date().toISOString()
            })
            .eq("stripe_subscription_id", invoice.subscription);
          
          if (error) {
            logStep("Error updating subscription on invoice failure", { error });
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
