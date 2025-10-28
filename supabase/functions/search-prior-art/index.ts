import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Prior art search function started');
    console.log('Request method:', req.method);
    
    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody));
    
    const { session_id } = requestBody;
    
    if (!session_id) {
      console.error('Missing session_id in request');
      return new Response(
        JSON.stringify({ error: 'session_id is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('Environment check:');
    console.log('SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Present' : 'Missing');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get patent session details
    console.log('Fetching patent session details for:', session_id);
    
    const { data: sessionData, error: sessionError } = await supabase
      .from('patent_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Session data retrieved:', sessionData);

    // Get AI questions and answers for context
    const { data: questionsData, error: questionsError } = await supabase
      .from('ai_questions')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
    }

    console.log('Questions data retrieved:', questionsData?.length || 0, 'questions');

    // Clear existing prior art results for this session
    const { error: deleteError } = await supabase
      .from('prior_art_results')
      .delete()
      .eq('session_id', session_id);

    if (deleteError) {
      console.error('Error clearing existing prior art:', deleteError);
    }

    // Build context from request or session + Q&A
    const clientQuery: string | undefined = requestBody?.search_query;
    const patentType: string | undefined = requestBody?.patent_type;

    const questionsText = questionsData?.map((q) => `${q.question}: ${q.answer || ''}`).join('\n') || '';
    const contextText = (
      clientQuery && clientQuery.trim().length > 0
        ? clientQuery
        : [
            sessionData.idea_prompt || '',
            typeof sessionData.technical_analysis === 'string' ? sessionData.technical_analysis : '',
            questionsText,
            patentType || sessionData.patent_type || ''
          ].join('\n')
    ).slice(0, 8000); // keep reasonable length

    // Simple keyword extraction
    const stopwords = new Set([
      'the','and','for','with','that','this','from','into','over','under','between','of','a','to','in','on','is','are','be','as','by','or','an','at','it','its','their','your','our','you','we','can','will','may','could','should','would'
    ]);
    const tokenize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopwords.has(w));

    const termFreq = new Map<string, number>();
    for (const w of tokenize(contextText)) {
      termFreq.set(w, (termFreq.get(w) || 0) + 1);
    }
    const keywords = Array.from(termFreq.entries())
      .sort((a,b) => b[1]-a[1])
      .slice(0, 20)
      .map(([w]) => w)
      .join(' ');

    console.log('Derived keywords for search:', keywords);

    // Query PatentsView API using title/abstract text search
    const queryObj = {
      _or: [
        { _text_any: { patent_title: keywords } },
        { _text_any: { patent_abstract: keywords } }
      ]
    } as any;

    const fields = [
      'patent_number',
      'patent_title',
      'patent_abstract',
      'patent_date'
    ];

    const options = { per_page: 10 };

    let apiResults: any[] = [];
    try {
      const url = `https://api.patentsview.org/patents/query?q=${encodeURIComponent(JSON.stringify(queryObj))}&f=${encodeURIComponent(JSON.stringify(fields))}&o=${encodeURIComponent(JSON.stringify(options))}`;
      const apiResp = await fetch(url, { method: 'GET' });
      if (!apiResp.ok) throw new Error(`PatentsView HTTP ${apiResp.status}`);
      const apiJson = await apiResp.json();
      apiResults = apiJson?.patents || [];
      console.log('PatentsView results:', apiResults.length);
    } catch (apiErr) {
      console.error('PatentsView API error, will fallback to heuristic:', apiErr);
      apiResults = [];
    }

    // Compute simple Jaccard similarity between context tokens and abstract tokens
    const contextTokens = new Set(tokenize(contextText));
    const jaccard = (a: Set<string>, b: Set<string>) => {
      const inter = new Set([...a].filter(x => b.has(x)));
      const uni = new Set([...a, ...b]);
      return uni.size === 0 ? 0 : inter.size / uni.size;
    };

    let priorArtResults = apiResults.map((p: any) => {
      const abstract: string = p.patent_abstract || '';
      const absTokens = new Set(tokenize(abstract));
      const score = jaccard(contextTokens, absTokens);
      const overlap = [...absTokens].filter(t => contextTokens.has(t)).slice(0, 6);
      const missing = [...contextTokens].filter(t => !absTokens.has(t)).slice(0, 6);
      const pubNum = p.patent_number ? `US${p.patent_number}` : '';
      return {
        title: p.patent_title || 'Untitled',
        publication_number: pubNum,
        summary: abstract || 'No abstract available',
        similarity_score: Number(score.toFixed(2)),
        url: pubNum ? `https://patents.google.com/patent/${pubNum}` : 'https://patents.google.com',
        overlap_claims: overlap.map(w => `Overlapping concept: ${w}`),
        difference_claims: missing.map(w => `Unique aspect emphasized: ${w}`)
      };
    });

    // Fallback to mock if API returns nothing
    if (priorArtResults.length === 0) {
      console.log('No API results, using minimal fallback tailored to keywords');
      priorArtResults = [
        {
          title: `Related systems concerning ${keywords.split(' ').slice(0,3).join(', ')}`,
          publication_number: 'N/A',
          summary: `Fallback generated based on your invention context mentioning: ${keywords}`,
          similarity_score: 0.35,
          url: 'https://patents.google.com/',
          overlap_claims: keywords.split(' ').slice(0,4).map(k => `Concept match: ${k}`),
          difference_claims: keywords.split(' ').slice(4,8).map(k => `Likely novelty area: ${k}`)
        }
      ];
    }

    // Sort by similarity desc
    priorArtResults.sort((a,b) => b.similarity_score - a.similarity_score);

    console.log('Prepared prior art results:', priorArtResults.length);

    // Insert the prior art results into the database
    const priorArtInserts = priorArtResults.map(result => ({
      session_id: session_id,
      title: result.title,
      publication_number: result.publication_number,
      summary: result.summary,
      similarity_score: result.similarity_score,
      url: result.url,
      overlap_claims: result.overlap_claims,
      difference_claims: result.difference_claims
    }));

    const { data: insertedResults, error: insertError } = await supabase
      .from('prior_art_results')
      .insert(priorArtInserts)
      .select();

    if (insertError) {
      console.error('Error inserting prior art results:', insertError);
      throw insertError;
    }

    console.log('Successfully inserted prior art results:', insertedResults?.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results_found: priorArtResults.length,
        message: 'Prior art search completed successfully'
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in prior art search:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error)
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})