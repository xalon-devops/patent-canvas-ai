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

    const { organizationId } = await req.json();

    if (!organizationId) {
      throw new Error('Missing organizationId parameter');
    }

    // Get the user's OAuth connection
    const { data: connection, error: connError } = await supabase
      .from('supabase_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('connection_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (connError || !connection) {
      throw new Error('No pending connection found');
    }

    // Fetch projects for the organization using the stored access token
    const projectsResponse = await fetch(
      `https://api.supabase.com/v1/projects?organization_id=${organizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
        },
      }
    );

    if (!projectsResponse.ok) {
      throw new Error('Failed to fetch projects from Supabase Management API');
    }

    const projects = await projectsResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        projects,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in get-supabase-projects:', error);
    
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
