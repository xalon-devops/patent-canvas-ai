import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';
import { getUserConnection, getValidAccessToken } from '../supabase-oauth-init/oauth-token.ts';

const SAFE_COLS = 'id, user_id, organization_id, project_ref, project_name, project_region, connection_status, is_active, token_expires_at, connection_metadata, created_at, updated_at';

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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { 
      connectionId, 
      organizationId, 
      projectId, 
      projectRef, 
      projectName, 
      projectRegion 
    } = await req.json();

    if (!connectionId || !organizationId || !projectId) {
      throw new Error('Missing required parameters');
    }

    // The connection must belong to the caller
    const connection = await getUserConnection(supabase, user.id, connectionId);
    if (!connection) {
      throw new Error('Connection not found. Please reconnect your Supabase account.');
    }

    // Verify the caller's token can actually access the chosen project, and use the
    // Management API's authoritative name/region instead of client-supplied values.
    const ref = String(projectRef || projectId);
    if (!/^[a-z0-9]{20}$/.test(ref)) {
      throw new Error('Invalid project reference');
    }
    const accessToken = await getValidAccessToken(supabase, connection);
    const projectRes = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!projectRes.ok) {
      throw new Error('That project is not accessible with your Supabase account.');
    }
    const project = await projectRes.json().catch(() => ({}));

    // Update the connection with project details and mark as active
    const { data: updated, error: updateError } = await supabase
      .from('supabase_connections')
      .update({
        organization_id: project?.organization_id || organizationId,
        project_ref: ref,
        project_name: project?.name || projectName || ref,
        project_region: project?.region || projectRegion || null,
        connection_status: 'active',
        is_active: true,
        connection_metadata: {
          ...(connection.connection_metadata ?? {}),
          project_id: projectId,
          connected_at: new Date().toISOString(),
        },
      })
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .select(SAFE_COLS)
      .maybeSingle();

    if (updateError || !updated) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to finalize connection');
    }

    // Ensure there is only ONE active connection per user.
    // This prevents project switching from leaving multiple active rows behind.
    const { error: deactivateOthersError } = await supabase
      .from('supabase_connections')
      .update({ is_active: false, connection_status: 'inactive' })
      .eq('user_id', user.id)
      .neq('id', connectionId);

    if (deactivateOthersError) {
      console.warn(
        '[FINALIZE] Failed to deactivate other connections (continuing):',
        deactivateOthersError,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        connection: updated,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in finalize-supabase-connection:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
