import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_supabase_url, user_supabase_key, session_id, use_oauth } = await req.json();

    console.log('[SUPABASE SCANNER] Starting backend analysis...');
    console.log('[SUPABASE SCANNER] OAuth mode:', use_oauth);

    // Our Supabase client
    const ourSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await ourSupabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    let managementApiToken = null;
    let projectRef = null;
    let targetUrl = user_supabase_url;

    // If OAuth mode, fetch connection from database
    if (use_oauth) {
      console.log('[SUPABASE SCANNER] Fetching OAuth connection...');
      
      const { data: connection, error: connError } = await ourSupabase
        .from('supabase_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('connection_status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (connError || !connection) {
        throw new Error('No active Supabase connection found. Please connect your Supabase project first.');
      }

      // Check if token is expired
      const expiresAt = new Date(connection.token_expires_at);
      if (expiresAt < new Date()) {
        throw new Error('Supabase connection expired. Please reconnect your project.');
      }

      // Check if project_ref is set (connection was finalized)
      if (!connection.project_ref) {
        throw new Error('Supabase connection not finalized. Please complete the project selection.');
      }

      managementApiToken = connection.access_token;
      projectRef = connection.project_ref;
      targetUrl = `https://${projectRef}.supabase.co`;
      
      console.log('[SUPABASE SCANNER] Using project:', connection.project_name || projectRef);
      console.log('[SUPABASE SCANNER] Using Management API with OAuth');
    } else if (!user_supabase_key) {
      throw new Error('Either enable OAuth or provide a service role key');
    } else {
      // Extract project ref from URL
      projectRef = user_supabase_url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    }

    console.log('[SUPABASE SCANNER] Target project:', projectRef);

    // Extract backend components
    let schema, storageBuckets, rlsPolicies, functions;

    if (managementApiToken) {
      // Use Management API SQL endpoint directly - no RPC needed!
      console.log('[SUPABASE SCANNER] Using Management API SQL endpoint...');
      
      // Fetch schema via Management API SQL query
      const schemaQuery = `
        SELECT 
          t.table_name,
          json_agg(
            json_build_object(
              'column_name', c.column_name,
              'data_type', c.data_type,
              'is_nullable', c.is_nullable,
              'column_default', c.column_default
            ) ORDER BY c.ordinal_position
          ) as columns
        FROM information_schema.tables t
        LEFT JOIN information_schema.columns c 
          ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        GROUP BY t.table_name
        ORDER BY t.table_name;
      `;

      const schemaResponse = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managementApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: schemaQuery }),
        }
      );

      if (schemaResponse.ok) {
        const schemaData = await schemaResponse.json();
        console.log('[SUPABASE SCANNER] Got schema via Management API:', schemaData?.length || 0, 'tables');
        
        const tables = (schemaData || []).map((t: any) => ({
          name: t.table_name,
          schema: 'public',
          columns: (t.columns || []).map((c: any) => ({
            name: c.column_name,
            type: c.data_type,
            nullable: c.is_nullable === 'YES',
            default: c.column_default,
          }))
        }));

        schema = {
          tables,
          total_columns: tables.reduce((acc: number, t: any) => acc + t.columns.length, 0)
        };
      } else {
        const errorText = await schemaResponse.text();
        console.log('[SUPABASE SCANNER] Schema query failed:', schemaResponse.status, errorText);
        schema = { tables: [], error: `Failed to fetch schema: ${schemaResponse.status}` };
      }

      // Fetch RLS info via Management API
      const rlsQuery = `
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

      const rlsResponse = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managementApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: rlsQuery }),
        }
      );

      if (rlsResponse.ok) {
        const rlsData = await rlsResponse.json();
        console.log('[SUPABASE SCANNER] Got RLS policies:', rlsData?.length || 0);
        rlsPolicies = { policies: rlsData || [] };
      } else {
        console.log('[SUPABASE SCANNER] RLS query failed:', rlsResponse.status);
        rlsPolicies = { policies: [] };
      }

      // Fetch storage buckets via Management API
      const storageResponse = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/storage/buckets`,
        {
          headers: {
            'Authorization': `Bearer ${managementApiToken}`,
          },
        }
      );

      if (storageResponse.ok) {
        const buckets = await storageResponse.json();
        storageBuckets = { buckets };
      } else {
        storageBuckets = { buckets: [] };
      }

      // Fetch edge functions via Management API
      const functionsResponse = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/functions`,
        {
          headers: {
            'Authorization': `Bearer ${managementApiToken}`,
          },
        }
      );

      if (functionsResponse.ok) {
        const funcs = await functionsResponse.json();
        functions = { 
          functions: funcs.map((f: any) => ({
            name: f.name,
            slug: f.slug,
            status: f.status,
            version: f.version,
            created_at: f.created_at,
            updated_at: f.updated_at
          }))
        };
        console.log('[SUPABASE SCANNER] Found functions:', funcs.length);
      } else {
        functions = { functions: [] };
      }


    } else {
      // Use service role key method
      console.log('[SUPABASE SCANNER] Using service role key method...');
      const userSupabase = createClient(targetUrl, user_supabase_key);
      
      schema = await extractDatabaseSchema(targetUrl, user_supabase_key);
      storageBuckets = await extractStorageBuckets(userSupabase);
      rlsPolicies = await extractRLSPolicies(targetUrl, user_supabase_key);
      functions = await extractFunctions(targetUrl, user_supabase_key);
    }

    // Compile comprehensive analysis
    const backendAnalysis = {
      database_schema: schema,
      storage_buckets: storageBuckets,
      rls_policies: rlsPolicies,
      functions: functions,
      metadata: {
        analyzed_at: new Date().toISOString(),
        source: 'supabase_backend',
        url: targetUrl,
        auth_method: use_oauth ? 'oauth' : 'service_key'
      }
    };

    // Store analysis in session
    if (session_id) {
      await ourSupabase
        .from('patent_sessions')
        .update({
          data_source: {
            type: 'supabase_backend',
            url: targetUrl,
            analysis: backendAnalysis,
            scanned_at: new Date().toISOString()
          }
        })
        .eq('id', session_id);
    }

    // Generate AI summary using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiSummary = '';

    if (LOVABLE_API_KEY) {
      console.log('[SUPABASE SCANNER] Generating AI architecture summary...');
      
      const summaryPrompt = `Analyze this Supabase backend and describe the invention/system in patent-friendly language:

DATABASE SCHEMA:
${JSON.stringify(schema, null, 2)}

STORAGE CONFIGURATION:
${JSON.stringify(storageBuckets, null, 2)}

RLS POLICIES:
${JSON.stringify(rlsPolicies, null, 2)}

FUNCTIONS:
${JSON.stringify(functions, null, 2)}

Provide:
1. High-level system description (what does this backend do?)
2. Key technical innovations (novel data structures, relationships, patterns)
3. Novel features or approaches (unique security, scalability, or architecture)
4. Security/access control innovations (RLS patterns, multi-tenancy)
5. Potential patent claims focus areas (specific technical elements to patent)

Format as clear, technical prose suitable for patent application background section.`;

      try {
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
                content: 'You are a patent attorney analyzing software systems. Identify novel technical features and innovations. Focus on what makes this system unique and patentable.' 
              },
              { role: 'user', content: summaryPrompt }
            ],
            temperature: 0.3,
            max_tokens: 2000
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiSummary = aiData.choices?.[0]?.message?.content || '';
        }
      } catch (aiError) {
        console.error('[AI Summary] Error:', aiError);
      }
    }

    console.log('[SUPABASE SCANNER] Analysis complete');

    return new Response(JSON.stringify({
      success: true,
      backend_analysis: backendAnalysis,
      ai_summary: aiSummary,
      statistics: {
        tables_found: schema.tables?.length || 0,
        columns_found: schema.total_columns || 0,
        rls_policies_found: rlsPolicies.policies?.length || 0,
        functions_found: functions.functions?.length || 0,
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

async function extractDatabaseSchema(url: string, key: string): Promise<any> {
  try {
    const projectId = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (!projectId) {
      return { tables: [], error: 'Invalid Supabase URL' };
    }

    const tablesResponse = await fetch(`${url}/rest/v1/rpc/get_tables_info`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    if (!tablesResponse.ok) {
      return {
        tables: [],
        note: 'Full schema extraction requires custom RPC function or Management API access',
        recommendation: 'Create RPC function: get_tables_info() to expose schema metadata'
      };
    }

    const data = await tablesResponse.json();
    const tables = data || [];
    
    const totalColumns = tables.reduce((acc: number, table: any) => 
      acc + (table.columns?.length || 0), 0
    );

    return {
      tables,
      total_columns: totalColumns,
      schema_type: 'public'
    };
  } catch (error) {
    console.error('[Schema Extraction] Error:', error);
    return {
      tables: [],
      error: error.message,
      note: 'Schema extraction requires elevated permissions or custom RPC function'
    };
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
        allowed_mime_types: b.allowed_mime_types,
        created_at: b.created_at
      })) || []
    };
  } catch (error) {
    console.error('[Storage Extraction] Error:', error);
    return { buckets: [], error: error.message };
  }
}

async function extractRLSPolicies(url: string, key: string): Promise<any> {
  try {
    const response = await fetch(`${url}/rest/v1/rpc/get_rls_policies`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    if (!response.ok) {
      return {
        policies: [],
        note: 'RLS policy extraction requires custom RPC function',
        recommendation: 'Create RPC: get_rls_policies() to expose pg_policies'
      };
    }

    const data = await response.json();
    return {
      policies: data || []
    };
  } catch (error) {
    console.error('[RLS Extraction] Error:', error);
    return {
      policies: [],
      error: error.message
    };
  }
}

async function extractFunctions(url: string, key: string): Promise<any> {
  try {
    const response = await fetch(`${url}/rest/v1/rpc/get_functions_info`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    if (!response.ok) {
      return {
        functions: [],
        note: 'Function extraction requires custom RPC or Management API',
        recommendation: 'Create RPC: get_functions_info() to expose function metadata'
      };
    }

    const data = await response.json();
    return {
      functions: data || []
    };
  } catch (error) {
    console.error('[Functions Extraction] Error:', error);
    return {
      functions: [],
      error: error.message
    };
  }
}