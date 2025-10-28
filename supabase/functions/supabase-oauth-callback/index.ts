import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    console.log('[OAUTH-CALLBACK] Fetching organizations with access token');
    const orgResponse = await fetch('https://api.supabase.com/v1/organizations', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    console.log('[OAUTH-CALLBACK] Org fetch response status:', orgResponse.status);
    
    if (!orgResponse.ok) {
      const errorText = await orgResponse.text();
      console.error('[OAUTH-CALLBACK] Org fetch failed:', errorText);
      throw new Error(`Failed to fetch organization info: ${orgResponse.status} - ${errorText}`);
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

    // Send success message to parent window and close popup
    console.log('[OAUTH-CALLBACK] Sending success message to parent');
    
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Successful</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'supabase-oauth-success'
              }, '${origin}');
              window.close();
            } else {
              window.location.href = '${origin}/select-supabase-project';
            }
          </script>
          <p>Connection successful! This window will close automatically...</p>
        </body>
      </html>
    `, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
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
    
    console.log('[OAUTH-CALLBACK] Sending error message to parent');
    
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'supabase-oauth-error',
                error: '${error.message.replace(/'/g, "\\'")}'
              }, '${errorOrigin}');
              window.close();
            } else {
              window.location.href = '${errorOrigin}/new-application?error=${encodeURIComponent(error.message)}';
            }
          </script>
          <p>Connection failed. This window will close automatically...</p>
        </body>
      </html>
    `, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
});