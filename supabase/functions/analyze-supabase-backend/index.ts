import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_supabase_url, user_supabase_key, session_id } = await req.json();

    console.log('[SUPABASE SCANNER] Starting backend analysis...');

    // Initialize user's Supabase client
    const userSupabase = createClient(user_supabase_url, user_supabase_key);

    // Our Supabase client
    const ourSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Extract Database Schema
    console.log('[SUPABASE SCANNER] Extracting database schema...');
    const schema = await extractDatabaseSchema(userSupabase);

    // 2. Extract Edge Functions (if accessible via management API)
    console.log('[SUPABASE SCANNER] Extracting edge functions...');
    const edgeFunctions = await extractEdgeFunctions(user_supabase_url, user_supabase_key);

    // 3. Extract RLS Policies
    console.log('[SUPABASE SCANNER] Extracting RLS policies...');
    const rlsPolicies = await extractRLSPolicies(userSupabase);

    // 4. Extract Database Functions
    console.log('[SUPABASE SCANNER] Extracting database functions...');
    const dbFunctions = await extractDatabaseFunctions(userSupabase);

    // 5. Extract Storage Buckets
    console.log('[SUPABASE SCANNER] Extracting storage configuration...');
    const storageBuckets = await extractStorageBuckets(userSupabase);

    // Compile comprehensive analysis
    const backendAnalysis = {
      database_schema: schema,
      edge_functions: edgeFunctions,
      rls_policies: rlsPolicies,
      database_functions: dbFunctions,
      storage_buckets: storageBuckets,
      metadata: {
        analyzed_at: new Date().toISOString(),
        source: 'supabase_backend'
      }
    };

    // Store analysis in session
    if (session_id) {
      await ourSupabase
        .from('patent_sessions')
        .update({
          data_source: {
            type: 'supabase_backend',
            url: user_supabase_url,
            analysis: backendAnalysis,
            scanned_at: new Date().toISOString()
          }
        })
        .eq('id', session_id);
    }

    // Generate AI summary of backend architecture
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiSummary = '';

    if (LOVABLE_API_KEY) {
      console.log('[SUPABASE SCANNER] Generating AI architecture summary...');
      
      const summaryPrompt = `Analyze this Supabase backend and describe the invention/system in patent-friendly language:

DATABASE SCHEMA:
${JSON.stringify(schema, null, 2)}

EDGE FUNCTIONS:
${JSON.stringify(edgeFunctions, null, 2)}

RLS POLICIES:
${JSON.stringify(rlsPolicies, null, 2)}

DATABASE FUNCTIONS:
${JSON.stringify(dbFunctions, null, 2)}

STORAGE:
${JSON.stringify(storageBuckets, null, 2)}

Provide:
1. High-level system description
2. Key technical innovations
3. Novel features or approaches
4. Security/access control innovations
5. Potential patent claims focus areas

Format as clear, technical prose suitable for patent application.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { 
              role: 'system', 
              content: 'You are a patent attorney analyzing software systems. Identify novel technical features and innovations.' 
            },
            { role: 'user', content: summaryPrompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        }),
      });

      const aiData = await aiResponse.json();
      aiSummary = aiData.choices?.[0]?.message?.content || '';
    }

    console.log('[SUPABASE SCANNER] Analysis complete');

    return new Response(JSON.stringify({
      success: true,
      backend_analysis: backendAnalysis,
      ai_summary: aiSummary,
      statistics: {
        tables_found: schema.tables?.length || 0,
        edge_functions_found: edgeFunctions.functions?.length || 0,
        rls_policies_found: rlsPolicies.policies?.length || 0,
        db_functions_found: dbFunctions.functions?.length || 0,
        storage_buckets_found: storageBuckets.buckets?.length || 0
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[SUPABASE SCANNER] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function extractDatabaseSchema(supabase: any): Promise<any> {
  try {
    // Get all tables in public schema
    const { data: tables, error } = await supabase
      .rpc('get_schema_info')
      .catch(() => ({ data: null, error: 'Schema extraction not available' }));

    // Fallback: Try to query information_schema
    if (!tables) {
      const tablesQuery = `
        SELECT 
          table_name,
          table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;
      
      const columnsQuery = `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
      `;

      // Note: This requires direct SQL access which may not be available via service role
      // If not available, return basic info
      return {
        tables: [],
        note: 'Full schema extraction requires Management API access'
      };
    }

    return { tables };
  } catch (error) {
    console.error('Schema extraction error:', error);
    return { tables: [], error: error.message };
  }
}

async function extractEdgeFunctions(url: string, key: string): Promise<any> {
  try {
    // Extract project ID from URL
    const projectId = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (!projectId) {
      return { functions: [], note: 'Could not extract project ID' };
    }

    // Try to list functions via Management API (requires service_role key)
    const functionsResponse = await fetch(`${url}/functions/v1`, {
      headers: {
        'Authorization': `Bearer ${key}`,
        'apikey': key
      }
    });

    if (!functionsResponse.ok) {
      return { functions: [], note: 'Edge functions listing not accessible' };
    }

    const functions = await functionsResponse.json();
    return { functions: Array.isArray(functions) ? functions : [] };
  } catch (error) {
    console.error('Edge functions extraction error:', error);
    return { functions: [], error: error.message };
  }
}

async function extractRLSPolicies(supabase: any): Promise<any> {
  try {
    // Query RLS policies from pg_policies view
    const policiesQuery = `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `;

    // This requires executing raw SQL which may not be available
    return {
      policies: [],
      note: 'RLS policy extraction requires direct database access'
    };
  } catch (error) {
    console.error('RLS extraction error:', error);
    return { policies: [], error: error.message };
  }
}

async function extractDatabaseFunctions(supabase: any): Promise<any> {
  try {
    // Query database functions
    const functionsQuery = `
      SELECT 
        proname as function_name,
        prosrc as function_source,
        pg_get_function_arguments(oid) as arguments,
        pg_get_function_result(oid) as return_type
      FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
      ORDER BY proname;
    `;

    return {
      functions: [],
      note: 'Database function extraction requires direct database access'
    };
  } catch (error) {
    console.error('DB functions extraction error:', error);
    return { functions: [], error: error.message };
  }
}

async function extractStorageBuckets(supabase: any): Promise<any> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) throw error;

    return {
      buckets: buckets?.map((b: any) => ({
        name: b.name,
        public: b.public,
        file_size_limit: b.file_size_limit,
        allowed_mime_types: b.allowed_mime_types
      })) || []
    };
  } catch (error) {
    console.error('Storage extraction error:', error);
    return { buckets: [], error: error.message };
  }
}