import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';
import { findCustomerIds, syncUserSubscription } from "../_shared/stripe-sync.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Called by /payment/return after an embedded Checkout completes.
 * Everything is confirmed against the Stripe API — nothing from the client is trusted
 * except the session id, and the session must belong to the authenticated caller.
 * Safe to call repeatedly (page refresh): writes are idempotent and never downgrade
 * an already-completed payment.
 *
 * Response: { success, type: 'subscription'|'payment', status: 'paid'|'processing'|'open'|'expired',
 *             alreadyProcessed?, payment?, subscription? }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not set');
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1) Authenticate the caller before touching Stripe or the DB.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required' }, 401);
    const { data: authData, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    const caller = authData?.user;
    if (authError || !caller) return json({ error: 'Invalid authentication token' }, 401);

    const { sessionId } = await req.json().catch(() => ({}));
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
      return json({ error: 'A valid checkout session id is required' }, 400);
    }

    // 2) Retrieve the checkout session from Stripe (source of truth).
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
    } catch (_e) {
      return json({ error: 'Checkout session not found' }, 404);
    }

    // 3) Ownership: metadata.user_id (set server-side by create-*) must be the caller.
    const metaUserId = session.metadata?.user_id;
    const sessionEmail = session.customer_details?.email?.toLowerCase();
    const ownsSession = metaUserId
      ? metaUserId === caller.id
      : !!sessionEmail && sessionEmail === caller.email?.toLowerCase();
    if (!ownsSession) {
      console.warn('Ownership mismatch on verify-payment', { callerId: caller.id, metaUserId });
      return json({ error: 'Not authorized to verify this payment' }, 403);
    }
    const userId = caller.id;
    const type = session.mode === 'subscription' ? 'subscription' : 'payment';

    console.log('Verifying session', { id: session.id, mode: session.mode, status: session.status, payment_status: session.payment_status });

    // 4) Checkout not finished (back button / cancelled) or expired.
    if (session.status === 'open') {
      return json({ success: false, type, status: 'open' });
    }
    if (session.status === 'expired') {
      return json({ success: false, type, status: 'expired' });
    }

    const paidOrFree = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
    const nowIso = new Date().toISOString();

    // ---- Subscription (Check & See / Trademark Suite) ----
    if (session.mode === 'subscription') {
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const customerIds = await findCustomerIds(stripe, caller.email, customerId);
      const result = await syncUserSubscription(stripe, supabase, userId, customerIds);
      const sub = session.subscription as Stripe.Subscription | null;
      const subActive = !!sub && (sub.status === 'active' || sub.status === 'trialing');

      const { error: txError } = await supabase
        .from('payment_transactions')
        .upsert({
          user_id: userId,
          stripe_session_id: session.id,
          amount: session.amount_total ?? 0,
          currency: session.currency || 'usd',
          status: paidOrFree ? 'completed' : 'pending',
          payment_type: 'subscription',
          description: session.metadata?.plan_type === 'trademark_suite'
            ? 'PatentBot AI — Trademark Suite Subscription'
            : 'PatentBot AI — Check & See Subscription',
          metadata: { subscription_id: sub?.id ?? null, plan_type: session.metadata?.plan_type ?? 'check_and_see' },
          updated_at: nowIso,
        }, { onConflict: 'stripe_session_id' });
      if (txError) console.error('Error recording transaction:', txError);

      return json({
        success: subActive || result.subscribed,
        type: 'subscription',
        status: subActive || result.subscribed ? 'paid' : 'processing',
        subscription: { id: sub?.id ?? null, status: sub?.status ?? result.status, plan: result.plan },
      });
    }

    // ---- One-time payment (patent application) ----
    const applicationId = session.metadata?.application_id;
    if (!applicationId) return json({ error: 'No application ID found in session metadata' }, 400);

    const { data: application } = await supabase
      .from('patent_sessions')
      .select('id, user_id, status')
      .eq('id', applicationId)
      .maybeSingle();
    if (!application || application.user_id !== userId) {
      return json({ error: 'Application not found' }, 404);
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
    const paid = session.payment_status === 'paid';

    const { data: existing, error: existingError } = await supabase
      .from('application_payments')
      .select('id, status')
      .eq('application_id', applicationId)
      .maybeSingle();
    if (existingError) throw existingError;
    const alreadyProcessed = existing?.status === 'completed';

    if (!alreadyProcessed) {
      const row = {
        user_id: userId,
        stripe_session_id: session.id,
        stripe_payment_id: paymentIntentId,
        amount: session.amount_total ?? 100000,
        currency: session.currency || 'usd',
        status: paid ? 'completed' : 'pending',
        updated_at: nowIso,
      };
      const { error: paymentError } = existing
        ? await supabase.from('application_payments').update(row).eq('id', existing.id).neq('status', 'completed')
        : await supabase.from('application_payments').insert({ ...row, application_id: applicationId });
      if (paymentError) {
        // A concurrent webhook may have inserted the row first (UNIQUE(application_id)); retry as update.
        if ((paymentError as { code?: string }).code === '23505') {
          await supabase.from('application_payments').update(row)
            .eq('application_id', applicationId).neq('status', 'completed');
        } else {
          console.error('Error recording application payment:', paymentError);
          throw paymentError;
        }
      }
    }

    const { error: txError } = await supabase
      .from('payment_transactions')
      .upsert({
        user_id: userId,
        application_id: applicationId,
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        amount: session.amount_total ?? 100000,
        currency: session.currency || 'usd',
        status: paid ? 'completed' : 'pending',
        payment_type: 'one_time',
        description: 'PatentBot AI — Patent Application Filing',
        metadata: { application_id: applicationId },
        updated_at: nowIso,
      }, { onConflict: 'stripe_session_id' });
    if (txError) console.error('Error recording transaction:', txError);

    if (paid && application.status !== 'filed' && application.status !== 'completed') {
      const { error: sessionError } = await supabase
        .from('patent_sessions')
        .update({ status: 'completed' })
        .eq('id', applicationId);
      if (sessionError) console.error('Error updating patent session:', sessionError);
    }

    return json({
      success: paid || alreadyProcessed,
      type: 'payment',
      status: paid || alreadyProcessed ? 'paid' : 'processing',
      alreadyProcessed,
      payment: { id: paymentIntentId, status: session.payment_status, applicationId },
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});
