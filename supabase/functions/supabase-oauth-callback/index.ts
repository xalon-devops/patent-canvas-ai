import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';
import { verifyState, originFromUntrustedState, scriptLiteral } from '../supabase-oauth-init/oauth-state.ts';

const htmlHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};

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
      throw new Error(`OAuth error: ${String(error).slice(0, 200)}`);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    // Verify HMAC-signed, unexpired state minted by supabase-oauth-init (CSRF protection).
    const stateData = await verifyState(state);
    if (!stateData) {
      throw new Error('Invalid or expired authorization request. Please try connecting again.');
    }
    const { userId, origin } = stateData;

    // Make sure the user still exists
    const { data: stateUser } = await supabase.auth.admin.getUserById(userId);
    if (!stateUser?.user) {
      throw new Error('Invalid authorization request.');
    }

    console.log('[OAUTH-CALLBACK] State verified for user:', userId);

    // Exchange code for tokens
    const clientId = Deno.env.get('SUPABASE_OAUTH_CLIENT_ID') || Deno.env.get('PATENTBOT_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('SUPABASE_OAUTH_CLIENT_SECRET') || Deno.env.get('PATENTBOT_OAUTH_CLIENT_SECRET');
    const callbackUrl = `${supabaseUrl}/functions/v1/supabase-oauth-callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Missing OAuth credentials. Set SUPABASE_OAUTH_CLIENT_ID/SECRET or PATENTBOT_OAUTH_CLIENT_ID/SECRET in Edge Function Secrets.');
    }

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
        scope: 'organizations:read projects:read',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[OAUTH-CALLBACK] Token exchange failed:', errorData);
      throw new Error('Failed to exchange authorization code. Please try again.');
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get organization info from Management API (non-fatal)
    let primaryOrg: any | null = null;
    try {
      console.log('[OAUTH-CALLBACK] Fetching organizations with access token');
      const orgResponse = await fetch('https://api.supabase.com/v1/organizations', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      });

      console.log('[OAUTH-CALLBACK] Org fetch response status:', orgResponse.status);
      
      if (orgResponse.ok) {
        const orgs = await orgResponse.json();
        primaryOrg = (orgs && orgs.length > 0) ? orgs[0] : null;
      } else {
        const errorText = await orgResponse.text();
        console.warn('[OAUTH-CALLBACK] Org fetch failed (non-fatal):', errorText);
      }
    } catch (e) {
      console.warn('[OAUTH-CALLBACK] Org fetch threw (non-fatal):', e);
    }

    // Store connection in database as PENDING (user needs to select project)
    const expiresAt = new Date(Date.now() + (Number(expires_in) > 0 ? Number(expires_in) : 3600) * 1000);
    if (!access_token) throw new Error("No access token returned by Supabase");
    
    const connectionMetadata: Record<string, any> = {
      oauth_callback_at: new Date().toISOString(),
      ...(primaryOrg ? { organization_name: primaryOrg.name } : {}),
    };

    // Ensure organization_id is present to satisfy NOT NULL constraint
    const orgId = primaryOrg?.id || 'unknown';

    // IMPORTANT: allow switching connected projects reliably.
    // We keep exactly one active connection per user by deactivating all previous connections
    // whenever a new OAuth flow completes.
    const { error: deactivateError } = await supabase
      .from('supabase_connections')
      .update({ is_active: false, connection_status: 'inactive' })
      .eq('user_id', userId);

    if (deactivateError) {
      console.warn(
        '[OAUTH-CALLBACK] Failed to deactivate previous connections (continuing):',
        deactivateError,
      );
    }

    const { error: insertError } = await supabase
      .from('supabase_connections')
      .insert({
        user_id: userId,
        organization_id: orgId,
        access_token,
        refresh_token,
        token_expires_at: expiresAt.toISOString(),
        scopes: tokenData.scope
          ? String(tokenData.scope).split(' ')
          : ['organizations:read', 'projects:read'],
        connection_metadata: connectionMetadata,
        connection_status: 'pending',
        is_active: false,
      });

    if (insertError) {
      console.error('Database error:', insertError);
      throw new Error('Failed to store connection');
    }

    console.log('[OAUTH-CALLBACK] Connection stored successfully, status: pending');
    
    // Small delay to ensure DB commit propagates
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send success message to parent window and close popup
    console.log('[OAUTH-CALLBACK] Sending success message to parent');
    
    return new Response(`<!DOCTYPE html>
      <html>
        <head>
          <title>Connection Successful</title>
        </head>
        <body>
          <script>
            (function () {
              var origin = ${scriptLiteral(origin)};
              if (window.opener) {
                window.opener.postMessage({ type: 'supabase-oauth-success' }, origin);
                window.close();
              } else {
                window.location.href = origin + '/select-supabase-project';
              }
            })();
          </script>
          <p>Connection successful! This window will close automatically...</p>
        </body>
      </html>
    `, {
      status: 200,
      headers: htmlHeaders,
    });

  } catch (error) {
    console.error('Error in supabase-oauth-callback:', error);
    
    // Origin is always passed through the allow-list (never trust the raw state here)
    const errorOrigin = originFromUntrustedState(new URL(req.url).searchParams.get('state'));
    const message = error instanceof Error ? error.message : 'Connection failed';

    return new Response(`<!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
        </head>
        <body>
          <script>
            (function () {
              var origin = ${scriptLiteral(errorOrigin)};
              var message = ${scriptLiteral(message)};
              if (window.opener) {
                window.opener.postMessage({ type: 'supabase-oauth-error', error: message }, origin);
                window.close();
              } else {
                window.location.href = origin + '/new-application?error=' + encodeURIComponent(message);
              }
            })();
          </script>
          <p>Connection failed. You can close this window and try again.</p>
        </body>
      </html>
    `, {
      status: 200,
      headers: htmlHeaders,
    });
  }
});
