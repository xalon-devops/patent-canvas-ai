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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
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

    // Update the connection with project details and mark as active
    const { data: updated, error: updateError } = await supabase
      .from('supabase_connections')
      .update({
        organization_id: organizationId,
        project_ref: projectRef,
        project_name: projectName,
        project_region: projectRegion,
        connection_status: 'active',
        is_active: true,
        connection_metadata: {
          project_id: projectId,
          connected_at: new Date().toISOString(),
        },
      })
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to finalize connection');
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
