import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';
import { getUserConnection, getValidAccessToken } from '../supabase-oauth-init/oauth-token.ts';

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

    const { organizationId } = await req.json();

    if (!organizationId) {
      throw new Error('Missing organizationId parameter');
    }

    // Get the user's most recent OAuth connection (pending or active)
    const connection = await getUserConnection(supabase, user.id);

    if (!connection) {
      throw new Error('No Supabase connection found. Please start the OAuth flow first.');
    }

    console.log('Found connection for projects:', connection.id);

    const accessToken = await getValidAccessToken(supabase, connection);

    // Fetch projects using the stored access token (server-side only)
    const projectsResponse = await fetch(
      `https://api.supabase.com/v1/projects?organization_id=${encodeURIComponent(String(organizationId))}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!projectsResponse.ok) {
      throw new Error('Failed to fetch projects from Supabase Management API');
    }

    const allProjects = await projectsResponse.json();
    // GET /v1/projects lists every project the token can see; keep the selected org's
    const list = Array.isArray(allProjects) ? allProjects : [];
    const inOrg = list.filter((p: any) => !p?.organization_id || p.organization_id === organizationId);
    // Fall back to the full list if the API uses a different org identifier format
    const projects = inOrg.length > 0 ? inOrg : list;

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
