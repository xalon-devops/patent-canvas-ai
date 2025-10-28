import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
      throw new Error('Unauthorized');
    }

    // Get app origin from Referer header (more reliable than origin header)
    const referer = req.headers.get('referer') || req.headers.get('origin') || 'http://localhost:8080';
    const appUrl = new URL(referer);
    const origin = `${appUrl.protocol}//${appUrl.host}`;
    
    const callbackUrl = `${supabaseUrl}/functions/v1/supabase-oauth-callback`;

    // Build Supabase OAuth URL
    const clientId = Deno.env.get('PATENTBOT_OAUTH_CLIENT_ID');
    
    if (!clientId) {
      throw new Error('PATENTBOT_OAUTH_CLIENT_ID not configured. Please add this secret.');
    }

    console.log('[OAUTH-INIT] Using origin:', origin);
    console.log('[OAUTH-INIT] Callback URL:', callbackUrl);

    const state = btoa(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      origin
    }));

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