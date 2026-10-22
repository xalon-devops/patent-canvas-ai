import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

// FREE_SEARCHES_LIMIT - synced with src/lib/pricingConstants.ts
const FREE_SEARCHES_LIMIT = 3;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Service role: user_search_credits has no client INSERT/UPDATE policy, so the row
    // for a new user must be created server-side. Caller is authenticated below.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = token
      ? await supabaseClient.auth.getUser(token)
      : { data: { user: null } };
    const user = userData?.user;

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Admin override: role or specific email bypasses credits/subscription checks
    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    // Admin is ONLY determined by user_roles table - no email bypass
    const isAdmin = !!adminRole;

    if (isAdmin) {
      console.log('Admin user detected - granting unlimited searches');
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

    // Check subscription status: same definition as the app (active or trialing, any
    // non-free plan — includes free_grant).
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('status, plan')
      .eq('user_id', user.id)
      .maybeSingle();

    const hasActiveSubscription = !!subscription &&
      (subscription.status === 'active' || subscription.status === 'trialing') &&
      !!subscription.plan && subscription.plan !== 'free';

    // Check/create search credits
    let { data: credits } = await supabaseClient
      .from('user_search_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Create credits record if it doesn't exist (idempotent under concurrent calls)
    if (!credits) {
      const { error } = await supabaseClient
        .from('user_search_credits')
        .upsert({
          user_id: user.id,
          searches_used: 0,
          free_searches_remaining: FREE_SEARCHES_LIMIT
        }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (error) throw error;

      const { data: fresh, error: readError } = await supabaseClient
        .from('user_search_credits')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (readError) throw readError;
      credits = fresh;
    }

    return new Response(JSON.stringify({
      success: true,
      has_subscription: hasActiveSubscription,
      free_searches_remaining: credits.free_searches_remaining,
      searches_used: credits.searches_used,
      can_search: hasActiveSubscription || credits.free_searches_remaining > 0,
      subscription_status: hasActiveSubscription ? subscription!.status : 'inactive',
      plan: hasActiveSubscription ? subscription!.plan : 'free_trial'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[CHECK CREDITS] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});