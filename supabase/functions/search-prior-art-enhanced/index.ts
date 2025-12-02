import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchSource {
  name: string;
  results: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, ideaTitle, ideaDescription } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Not authenticated');
    }

    console.log('[ENHANCED SEARCH] Starting multi-source patent search');

    // Admin override: role or specific email bypasses credits/subscription checks
    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    const adminEmail = 'nash@kronoscapital.us';
    const isAdminEmail = (user.email || '').toLowerCase() === adminEmail;
    const isAdmin = !!adminRole || isAdminEmail;

    if (isAdmin) {
      console.log('[ENHANCED SEARCH] Admin user detected - bypassing credit check');
    }

    // Check subscription status
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const hasActiveSubscription = !!subscription || isAdmin;

    // Check/create search credits (auto-create if not exists)
    let { data: credits } = await supabaseClient
      .from('user_search_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Create credits record if it doesn't exist (new user gets 3 free searches)
    if (!credits) {
      console.log('[ENHANCED SEARCH] Creating new credits record for user');
      const { data: newCredits, error: createError } = await supabaseClient
        .from('user_search_credits')
        .insert({
          user_id: user.id,
          searches_used: 0,
          free_searches_remaining: 3
        })
        .select()
        .single();

      if (createError) {
        console.error('[ENHANCED SEARCH] Failed to create credits:', createError);
        throw new Error('Failed to initialize search credits');
      }
      credits = newCredits;
    }

    const hasCredits = credits && credits.free_searches_remaining > 0;

    if (!hasActiveSubscription && !hasCredits) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No search credits remaining. Please subscribe to continue.',
        requires_subscription: true
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Deduct credit if using free trial (not for subscribers or admins)
    if (!hasActiveSubscription && hasCredits) {
      await supabaseClient
        .from('user_search_credits')
        .update({
          searches_used: (credits.searches_used || 0) + 1,
          free_searches_remaining: credits.free_searches_remaining - 1,
          last_search_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
    }

    // Get session data for context
    let contextText = '';
    if (session_id) {
      const { data: sessionData } = await supabaseClient
        .from('patent_sessions')
        .select('*, ai_questions(*)')
        .eq('id', session_id)
        .single();

      if (sessionData) {
        contextText = sessionData.idea_prompt || '';
        sessionData.ai_questions?.forEach((q: any) => {
          if (q.answer) {
            contextText += ` ${q.question} ${q.answer}`;
          }
        });
      }
    } else {
      contextText = `${ideaTitle || ''} ${ideaDescription || ''}`;
    }

    // Generate embedding for semantic search
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    let queryEmbedding: number[] | null = null;

    if (OPENAI_API_KEY) {
      console.log('[ENHANCED SEARCH] Generating query embedding');
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

      const embeddingData = await embeddingResponse.json();
      queryEmbedding = embeddingData.data?.[0]?.embedding;
    }

    // Source 1: PatentsView API (US Patents)
    console.log('[ENHANCED SEARCH] Searching PatentsView');
    const patentsViewResults = await searchPatentsView(contextText);

    // Source 2: Google Patents (if Lens API key available)
    console.log('[ENHANCED SEARCH] Searching Google Patents');
    const googlePatentsResults = await searchGooglePatents(contextText);

    // Combine and rank results
    const allResults = [
      ...patentsViewResults.map(r => ({ ...r, source: 'patentsview' })),
      ...googlePatentsResults.map(r => ({ ...r, source: 'google_patents' }))
    ];

    // Generate embeddings and calculate semantic similarity for each result
    const rankedResults = [];
    for (const result of allResults.slice(0, 20)) { // Process top 20 to save API costs
      let semanticScore = 0;
      
      if (queryEmbedding && OPENAI_API_KEY) {
        const resultText = `${result.title} ${result.summary}`.substring(0, 8000);
        const resultEmbResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: resultText,
          }),
        });

        const resultEmbData = await resultEmbResponse.json();
        const resultEmbedding = resultEmbData.data?.[0]?.embedding;

        if (resultEmbedding) {
          // Cosine similarity
          semanticScore = cosineSimilarity(queryEmbedding, resultEmbedding);
          result.embedding = `[${resultEmbedding.join(',')}]`;
        }
      }

      // Combined scoring: semantic (60%) + keyword match (40%)
      const keywordScore = calculateKeywordMatch(contextText, result.title + ' ' + result.summary);
      const finalScore = (semanticScore * 0.6) + (keywordScore * 0.4);

      rankedResults.push({
        ...result,
        similarity_score: finalScore,
        semantic_score: semanticScore,
        keyword_score: keywordScore
      });
    }

    // Sort by final score
    rankedResults.sort((a, b) => b.similarity_score - a.similarity_score);

    // Store top results in database
    if (session_id) {
      // Clear existing results
      await supabaseClient
        .from('prior_art_results')
        .delete()
        .eq('session_id', session_id);

      // Insert new results
      const resultsToStore = rankedResults.slice(0, 15).map(result => ({
        session_id,
        title: result.title,
        publication_number: result.publication_number,
        summary: result.summary,
        similarity_score: result.similarity_score,
        url: result.url,
        source: result.source,
        patent_date: result.patent_date,
        assignee: result.assignee,
        overlap_claims: result.overlap_claims || [],
        difference_claims: result.difference_claims || [],
        embedding: result.embedding || null
      }));

      await supabaseClient
        .from('prior_art_results')
        .insert(resultsToStore);
    }

    console.log(`[ENHANCED SEARCH] Complete: ${rankedResults.length} results, top score: ${rankedResults[0]?.similarity_score || 0}`);

    return new Response(JSON.stringify({
      success: true,
      results: rankedResults.slice(0, 15),
      results_found: rankedResults.length,
      sources_used: ['patentsview', 'google_patents'],
      search_credits_remaining: hasActiveSubscription ? 'unlimited' : (credits?.free_searches_remaining - 1)
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ENHANCED SEARCH] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function searchPatentsView(query: string): Promise<any[]> {
  try {
    const keywords = extractKeywords(query);
    const searchQuery = keywords.slice(0, 5).join(' OR ');
    
    const url = `https://api.patentsview.org/patents/query?q={"_or":[{"patent_title":"${encodeURIComponent(searchQuery)}"},{"patent_abstract":"${encodeURIComponent(searchQuery)}"}]}&f=["patent_number","patent_title","patent_abstract","patent_date","assignee_organization"]&o={"per_page":10}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return (data.patents || []).map((p: any) => ({
      title: p.patent_title || 'No title',
      publication_number: p.patent_number || 'Unknown',
      summary: p.patent_abstract || 'No abstract available',
      url: `https://patents.google.com/patent/${p.patent_number}`,
      patent_date: p.patent_date,
      assignee: p.assignee_organization?.[0] || 'Unknown'
    }));
  } catch (error) {
    console.error('[PatentsView] Error:', error);
    return [];
  }
}

async function searchGooglePatents(query: string): Promise<any[]> {
  // Placeholder for Google Patents API integration
  // Would require Lens API or scraping fallback
  const LENS_API_KEY = Deno.env.get('LENS_API_KEY');
  
  if (!LENS_API_KEY) {
    return [];
  }

  try {
    const response = await fetch('https://api.lens.org/patent/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LENS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query.substring(0, 500),
        size: 10
      })
    });

    const data = await response.json();
    
    return (data.results || []).map((p: any) => ({
      title: p.title || 'No title',
      publication_number: p.lens_id || 'Unknown',
      summary: p.abstract || 'No abstract available',
      url: p.lens_url || '#',
      patent_date: p.date_published,
      assignee: p.applicants?.[0] || 'Unknown'
    }));
  } catch (error) {
    console.error('[Google Patents/Lens] Error:', error);
    return [];
  }
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during']);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  
  const freq: { [key: string]: number } = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(e => e[0]);
}

function calculateKeywordMatch(query: string, text: string): number {
  const queryKeywords = new Set(extractKeywords(query).slice(0, 10));
  const textKeywords = new Set(extractKeywords(text));
  
  let matches = 0;
  queryKeywords.forEach(k => {
    if (textKeywords.has(k)) matches++;
  });
  
  return queryKeywords.size > 0 ? matches / queryKeywords.size : 0;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}