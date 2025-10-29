import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Admin override: role or specific email bypasses credits/subscription checks
    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    const adminEmail = 'nash@kronoscapital.us';
    const isAdminEmail = (user.email || '').toLowerCase() === adminEmail;
    const isAdmin = !!adminRole || isAdminEmail;

    if (isAdmin) {
      console.log('Admin user detected - granting unlimited searches', { viaEmail: isAdminEmail });
      return new Response(JSON.stringify({
        success: true,
        has_subscription: true,
        free_searches_remaining: 999999,
        searches_used: 0,
        can_search: true,
        subscription_status: 'admin',
        plan: 'admin'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check subscription status
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const hasActiveSubscription = !!subscription;

    // Check/create search credits
    let { data: credits } = await supabaseClient
      .from('user_search_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Create credits record if it doesn't exist
    if (!credits) {
      const { data: newCredits, error } = await supabaseClient
        .from('user_search_credits')
        .insert({
          user_id: user.id,
          searches_used: 0,
          free_searches_remaining: 3
        })
        .select()
        .single();

      if (error) throw error;
      credits = newCredits;
    }

    return new Response(JSON.stringify({
      success: true,
      has_subscription: hasActiveSubscription,
      free_searches_remaining: credits.free_searches_remaining,
      searches_used: credits.searches_used,
      can_search: hasActiveSubscription || credits.free_searches_remaining > 0,
      subscription_status: subscription?.status || 'inactive',
      plan: subscription?.plan || 'free_trial'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[CHECK CREDITS] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});