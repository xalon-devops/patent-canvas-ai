import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';
import { signState, safeAppOrigin } from './oauth-state.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // App origin (Origin preferred, then Referer) - restricted to an allow-list so the
    // callback can never postMessage/redirect tokens' status to a foreign site.
    const origin = safeAppOrigin(req.headers.get('origin') || req.headers.get('referer'));

    const callbackUrl = `${supabaseUrl}/functions/v1/supabase-oauth-callback`;

    // Build Supabase OAuth URL (with safe fallbacks)
    const clientId = Deno.env.get('SUPABASE_OAUTH_CLIENT_ID') || Deno.env.get('PATENTBOT_OAUTH_CLIENT_ID');
    
    if (!clientId) {
      throw new Error('Missing OAuth client ID. Set SUPABASE_OAUTH_CLIENT_ID (preferred) or PATENTBOT_OAUTH_CLIENT_ID in Edge Function Secrets.');
    }

    console.log('[OAUTH-INIT] Using origin:', origin);
    console.log('[OAUTH-INIT] Callback URL:', callbackUrl);

    // HMAC-signed, expiring state (validated in supabase-oauth-callback)
    const state = await signState(user.id, origin);

    const authUrl = new URL('https://api.supabase.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'all');
    authUrl.searchParams.set('state', state);

    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(),
        message: 'Redirect user to this URL to authorize Supabase access'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in supabase-oauth-init:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to initialize Supabase OAuth flow'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});