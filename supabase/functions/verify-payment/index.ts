import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'npm:@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    console.log('Verifying payment session:', sessionId);

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'subscription']
    });

    console.log('Session retrieved:', {
      id: session.id,
      mode: session.mode,
      status: session.payment_status,
      customer: session.customer
    });

    // Get user ID from session metadata first (fastest), then fallback to email lookup
    let userId = session.metadata?.user_id;
    const userEmail = session.customer_details?.email;
    
    if (!userId && !userEmail) {
      throw new Error('No user ID or customer email found in session');
    }

    if (!userId && userEmail) {
      // Lookup by email using admin API (efficient single lookup)
      const { data: usersByEmail } = await supabase.auth.admin.listUsers({
        filter: `email.eq.${userEmail}`,
        page: 1,
        perPage: 1,
      });
      const user = usersByEmail?.users?.[0];
      if (!user) throw new Error('User not found for email: ' + userEmail);
      userId = user.id;
    }

    console.log('Resolved userId:', userId);

    // Handle subscription payment
    if (session.mode === 'subscription' && session.subscription) {
      const subscription = session.subscription as Stripe.Subscription;
      
      console.log('Processing subscription:', {
        id: subscription.id,
        status: subscription.status,
        userId
      });

      // Upsert subscription record
      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          plan: session.metadata?.plan_type || 'check_and_see',
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (subError) {
        console.error('Error upserting subscription:', subError);
        throw subError;
      }

      // Record payment transaction
      const { error: txError } = await supabase
        .from('payment_transactions')
        .insert({
          user_id: userId,
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string,
          amount: session.amount_total || 999,
          currency: session.currency || 'usd',
          status: session.payment_status === 'paid' ? 'completed' : 'pending',
          payment_type: 'subscription',
          description: 'Check & See Subscription',
          metadata: { subscription_id: subscription.id }
        });

      if (txError) {
        console.error('Error recording transaction:', txError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          type: 'subscription',
          subscription: {
            id: subscription.id,
            status: subscription.status
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle one-time payment (patent application)
    if (session.mode === 'payment') {
      const applicationId = session.metadata?.application_id;
      const paymentIntentId = session.payment_intent as string;

      console.log('Processing one-time payment:', {
        applicationId,
        paymentIntentId,
        userId,
        status: session.payment_status
      });

      if (!applicationId) {
        throw new Error('No application ID found in session metadata');
      }

      // Update or insert application payment
      const { error: paymentError } = await supabase
        .from('application_payments')
        .upsert({
          application_id: applicationId,
          user_id: userId,
          stripe_session_id: session.id,
          stripe_payment_id: paymentIntentId,
          amount: session.amount_total || 100000,
          currency: session.currency || 'usd',
          status: session.payment_status === 'paid' ? 'completed' : 'pending',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'application_id'
        });

      if (paymentError) {
        console.error('Error recording application payment:', paymentError);
        throw paymentError;
      }

      // Record payment transaction
      const { error: txError } = await supabase
        .from('payment_transactions')
        .insert({
          user_id: userId,
          application_id: applicationId,
          stripe_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId,
          amount: session.amount_total || 100000,
          currency: session.currency || 'usd',
          status: session.payment_status === 'paid' ? 'completed' : 'pending',
          payment_type: 'patent_application',
          description: 'Patent Application Payment',
          metadata: { application_id: applicationId }
        });

      if (txError) {
        console.error('Error recording transaction:', txError);
      }

      // Update patent session status if payment completed
      if (session.payment_status === 'paid') {
        const { error: sessionError } = await supabase
          .from('patent_sessions')
          .update({ status: 'completed' })
          .eq('id', applicationId);

        if (sessionError) {
          console.error('Error updating patent session:', sessionError);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          type: 'payment',
          payment: {
            id: paymentIntentId,
            status: session.payment_status,
            applicationId
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Unknown session mode: ' + session.mode);

  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});