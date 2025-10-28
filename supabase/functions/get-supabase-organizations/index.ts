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

    // Fetch organizations using the stored access token
    const orgResponse = await fetch('https://api.supabase.com/v1/organizations', {
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
      },
    });

    if (!orgResponse.ok) {
      throw new Error('Failed to fetch organizations from Supabase Management API');
    }

    const organizations = await orgResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        organizations,
        connectionId: connection.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in get-supabase-organizations:', error);
    
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
