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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    // Decode state
    const stateData = JSON.parse(atob(state));
    const { userId, origin } = stateData;
    
    console.log('[OAUTH-CALLBACK] Decoded origin:', origin);
    console.log('[OAUTH-CALLBACK] User ID:', userId);

    // Exchange code for tokens
    const clientId = Deno.env.get('PATENTBOT_OAUTH_CLIENT_ID')!;
    const clientSecret = Deno.env.get('PATENTBOT_OAUTH_CLIENT_SECRET')!;
    const callbackUrl = `${supabaseUrl}/functions/v1/supabase-oauth-callback`;

    const tokenResponse = await fetch('https://api.supabase.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      throw new Error(`Failed to exchange code for token: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get organization info from Management API
    const orgResponse = await fetch('https://api.supabase.com/v1/organizations', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!orgResponse.ok) {
      throw new Error('Failed to fetch organization info');
    }

    const orgs = await orgResponse.json();
    const primaryOrg = orgs[0]; // Use first org

    // Store connection in database as PENDING (user needs to select project)
    const expiresAt = new Date(Date.now() + (expires_in * 1000));
    
    const { error: dbError } = await supabase
      .from('supabase_connections')
      .upsert({
        user_id: userId,
        organization_id: primaryOrg.id,
        access_token,
        refresh_token,
        token_expires_at: expiresAt.toISOString(),
        scopes: ['all'],
        connection_metadata: {
          organization_name: primaryOrg.name,
          oauth_callback_at: new Date().toISOString(),
        },
        connection_status: 'pending',
        is_active: false,
      }, {
        onConflict: 'user_id',
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store connection');
    }

    // Redirect to project selection page
    const redirectUrl = `${origin}/select-supabase-project`;
    
    console.log('[OAUTH-CALLBACK] Redirecting to:', redirectUrl);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
      },
    });

  } catch (error) {
    console.error('Error in supabase-oauth-callback:', error);
    
    // Try to get origin from state first, fallback to referer
    let errorOrigin = 'https://yourapp.com';
    try {
      const url = new URL(req.url);
      const errorState = url.searchParams.get('state');
      if (errorState) {
        const stateData = JSON.parse(atob(errorState));
        errorOrigin = stateData.origin;
      }
    } catch {
      // Fallback to referer
      const referer = req.headers.get('referer');
      if (referer) {
        const refUrl = new URL(referer);
        errorOrigin = `${refUrl.protocol}//${refUrl.host}`;
      }
    }
    
    const errorUrl = `${errorOrigin}/new-application?error=${encodeURIComponent(error.message)}`;
    console.log('[OAUTH-CALLBACK] Error redirect to:', errorUrl);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': errorUrl,
      },
    });
  }
});