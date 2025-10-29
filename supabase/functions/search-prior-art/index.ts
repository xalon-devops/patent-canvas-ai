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

    // Get patent session details with all related data
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
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session data retrieved:', sessionData.idea_prompt);

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

    // Extract backend analysis for smarter search
    const backendData = sessionData.data_source?.supabase_backend || null;
    const backendSummary = backendData?.ai_summary || '';
    const backendStats = backendData?.statistics || {};
    
    console.log('Backend data:', {
      hasSummary: !!backendSummary,
      tables: backendStats.tables_found || 0,
      functions: backendStats.functions_found || 0
    });

    // Clear existing prior art results for this session
    const { error: deleteError } = await supabase
      .from('prior_art_results')
      .delete()
      .eq('session_id', session_id);

    if (deleteError) {
      console.error('Error clearing existing prior art:', deleteError);
    }

    // Build context from request or session + Q&A + backend analysis
    const clientQuery: string | undefined = requestBody?.search_query;
    const patentType: string | undefined = requestBody?.patent_type;

    const questionsText = questionsData?.map((q) => `${q.question}: ${q.answer || ''}`).join('\n') || '';
    
    // Build rich context including backend analysis
    const contextParts = [
      sessionData.idea_prompt || '',
      typeof sessionData.technical_analysis === 'string' ? sessionData.technical_analysis : '',
      questionsText,
      backendSummary ? `Backend: ${backendSummary}` : '',
      patentType || sessionData.patent_type || ''
    ].filter(p => p.length > 0);
    
    const contextText = (clientQuery && clientQuery.trim().length > 0
      ? clientQuery
      : contextParts.join('\n')
    ).slice(0, 10000);
    
    console.log('Search context length:', contextText.length, 'chars');
    console.log('Context includes backend:', !!backendSummary);

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

    // Query patent databases via Perplexity AI
    let apiResults: any[] = [];
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!PERPLEXITY_API_KEY) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Patent search API not configured. Please contact support.',
          details: 'Missing PERPLEXITY_API_KEY'
        }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    try {
      // Using Perplexity sonar-pro for patent search (updated 2025-10-29)
      console.log('Querying patent databases via Perplexity AI...');
      
      const searchPrompt = `Search the web for existing US patents related to: ${contextText.substring(0, 1500)}

Find 10-15 real patents by searching Google Patents website, USPTO.gov, and patent information sites. 

For EACH patent you find, extract:
- Patent number (e.g., US1234567, US20210123456)
- Title
- Brief description/abstract (50-100 words)
- Filing or publication date
- Assignee/inventor name

Return ONLY a JSON array, no other text:
[{"patent_number":"US...","title":"...","abstract":"...","date":"YYYY-MM-DD","assignee":"..."}]`;
      
      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: 'You are a patent search expert. Search patent databases and return structured JSON data only. Be precise and factual.'
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 4000,
          return_images: false,
          return_related_questions: false
        }),
      });

      if (!perplexityResponse.ok) {
        const errorText = await perplexityResponse.text();
        console.error(`Perplexity API HTTP ${perplexityResponse.status}:`, errorText);
      } else {
        const perplexityData = await perplexityResponse.json();
        const responseText = perplexityData.choices?.[0]?.message?.content || '';
        console.log('Perplexity response length:', responseText.length);
        
        // Parse JSON from response (handle markdown code blocks)
        let jsonText = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1];
        } else if (responseText.includes('[') && responseText.includes(']')) {
          const start = responseText.indexOf('[');
          const end = responseText.lastIndexOf(']') + 1;
          jsonText = responseText.substring(start, end);
        }
        
        try {
          const parsedResults = JSON.parse(jsonText);
          if (Array.isArray(parsedResults)) {
            apiResults = parsedResults.map((p: any) => ({
              patent_number: p.patent_number || p.patentNumber || '',
              patent_title: p.title || '',
              patent_abstract: p.abstract || p.summary || '',
              patent_date: p.date || p.filing_date || p.publication_date || null,
              assignee_organization: [p.assignee || p.inventor || 'Unknown']
            }));
            console.log('✓ Perplexity found patents:', apiResults.length);
          }
        } catch (parseErr) {
          console.error('Failed to parse Perplexity JSON:', parseErr);
          console.log('Raw response:', responseText.substring(0, 500));
        }
      }
    } catch (apiErr) {
      console.error('Perplexity API error:', apiErr instanceof Error ? apiErr.message : String(apiErr));
      apiResults = [];
    }

    // Generate semantic embedding using OpenAI for smarter search (not Lovable AI)
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    let queryEmbedding: number[] | null = null;

    if (OPENAI_API_KEY) {
      try {
        console.log('Generating semantic embedding with OpenAI...');
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: contextText.substring(0, 8000),
          }),
        });

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          queryEmbedding = embeddingData.data?.[0]?.embedding;
          console.log('✓ Query embedding generated');
        } else {
          const errorText = await embeddingResponse.text();
          console.error(`Embedding API error ${embeddingResponse.status}:`, errorText);
        }
      } catch (err) {
        console.error('Error generating embedding:', err instanceof Error ? err.message : String(err));
      }
    } else {
      console.log('OpenAI API key not available, using keyword-only search');
    }

    // Compute similarity scores: semantic (AI) + keyword (Jaccard)
    const contextTokens = new Set(tokenize(contextText));
    const jaccard = (a: Set<string>, b: Set<string>) => {
      const inter = new Set([...a].filter(x => b.has(x)));
      const uni = new Set([...a, ...b]);
      return uni.size === 0 ? 0 : inter.size / uni.size;
    };

    const cosineSimilarity = (a: number[], b: number[]): number => {
      let dotProduct = 0, normA = 0, normB = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return normA > 0 && normB > 0 ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
    };

    let priorArtResults = [];
    
    for (const p of apiResults) {
      const abstract: string = p.patent_abstract || '';
      const title: string = p.patent_title || '';
      const assignee: string = p.assignee_organization?.[0] || 'Independent Inventor';
      const combinedText = `${title} ${abstract}`;
      const absTokens = new Set(tokenize(combinedText));
      
      // Keyword score (Jaccard)
      const keywordScore = jaccard(contextTokens, absTokens);
      
      // Semantic score (AI embeddings via OpenAI)
      let semanticScore = 0;
      if (queryEmbedding && OPENAI_API_KEY) {
        try {
          const patentEmbResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: combinedText.substring(0, 8000),
            }),
          });

          if (patentEmbResponse.ok) {
            const patentEmbData = await patentEmbResponse.json();
            const patentEmbedding = patentEmbData.data?.[0]?.embedding;
            if (patentEmbedding) {
              semanticScore = cosineSimilarity(queryEmbedding, patentEmbedding);
            }
          } else {
            const errorText = await patentEmbResponse.text();
            console.error(`Patent embedding error ${patentEmbResponse.status}:`, errorText);
          }
        } catch (err) {
          console.error('Error generating patent embedding:', err instanceof Error ? err.message : String(err));
        }
      }
      
      // Combined score: semantic 70%, keyword 30% (if embeddings available, otherwise pure keyword)
      const finalScore = queryEmbedding 
        ? (semanticScore * 0.7 + keywordScore * 0.3)
        : keywordScore;
      
      // Extract overlapping and unique concepts
      const overlap = [...absTokens].filter(t => contextTokens.has(t));
      const missing = [...contextTokens].filter(t => !absTokens.has(t));
      
      // Create smarter overlap and difference claims
      const overlapClaims = overlap.slice(0, 5).map(w => {
        const templates = [
          `Uses "${w}" technology`,
          `Implements ${w}-based approach`,
          `Incorporates ${w} functionality`,
          `Features ${w} capabilities`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      });
      
      const differenceClaims = missing.slice(0, 5).map(w => {
        const templates = [
          `Your novel ${w} implementation`,
          `Unique ${w} integration`,
          `Proprietary ${w} approach`,
          `Advanced ${w} features`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      });
      
      // Add backend-specific differentiators
      if (backendStats.tables_found > 0) {
        differenceClaims.push(`Custom database with ${backendStats.tables_found} specialized tables`);
      }
      if (backendStats.functions_found > 0) {
        differenceClaims.push(`${backendStats.functions_found} proprietary serverless functions`);
      }
      
      const pubNum = p.patent_number ? `US${p.patent_number}` : '';
      priorArtResults.push({
        title: title || 'Untitled Patent',
        publication_number: pubNum,
        summary: abstract.slice(0, 500) || 'No abstract available',
        similarity_score: Math.min(0.95, Number(finalScore.toFixed(3))),
        semantic_score: Number(semanticScore.toFixed(3)),
        keyword_score: Number(keywordScore.toFixed(3)),
        assignee: assignee,
        url: pubNum ? `https://patents.google.com/patent/${pubNum}` : 'https://patents.google.com',
        overlap_claims: overlapClaims.length > 0 ? overlapClaims.slice(0, 5) : ['General technological approach'],
        difference_claims: differenceClaims.length > 0 ? differenceClaims.slice(0, 5) : ['Specific implementation details'],
        patent_date: p.patent_date || null
      });
    }
    
    // Sort by combined similarity score
    priorArtResults.sort((a, b) => b.similarity_score - a.similarity_score);
    
    console.log(`Processed ${priorArtResults.length} results with ${queryEmbedding ? 'semantic + keyword' : 'keyword-only'} scoring`);

    // If no results found, that's actually good news for patentability!
    if (priorArtResults.length === 0) {
      console.log('No prior art found - strong novelty indicator');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          results_found: 0,
          message: 'No similar patents found - this indicates strong novelty for your invention!'
        }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Sort by similarity desc
    priorArtResults.sort((a,b) => b.similarity_score - a.similarity_score);

    console.log('Prepared prior art results:', priorArtResults.length);

    // Insert the prior art results into the database with all scores
    const priorArtInserts = priorArtResults.map(result => ({
      session_id: session_id,
      title: result.title,
      publication_number: result.publication_number,
      summary: result.summary,
      similarity_score: result.similarity_score,
      semantic_score: result.semantic_score || 0,
      keyword_score: result.keyword_score || 0,
      assignee: result.assignee || 'Unknown',
      url: result.url,
      overlap_claims: result.overlap_claims,
      difference_claims: result.difference_claims,
      patent_date: result.patent_date,
      source: 'patentsview'
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : 'No stack trace';
    
    console.error('Error in prior art search:', errorMessage);
    console.error('Error details:', errorDetails);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error', 
        details: errorMessage,
        message: 'Failed to complete prior art search'
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})