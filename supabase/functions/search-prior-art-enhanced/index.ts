import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    // Admin override
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
      console.log('[ENHANCED SEARCH] Admin user - bypassing credit check');
    }

    // Check subscription
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const hasActiveSubscription = !!subscription || isAdmin;

    // Get or create credits
    let { data: credits } = await supabaseClient
      .from('user_search_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!credits) {
      console.log('[ENHANCED SEARCH] Creating new credits for user');
      const { data: newCredits, error: createError } = await supabaseClient
        .from('user_search_credits')
        .insert({ user_id: user.id, searches_used: 0, free_searches_remaining: 3 })
        .select()
        .single();

      if (createError) throw new Error('Failed to initialize search credits');
      credits = newCredits;
    }

    const hasCredits = credits && credits.free_searches_remaining > 0;

    if (!hasActiveSubscription && !hasCredits) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No search credits remaining. Please subscribe to continue.',
        requires_subscription: true
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Deduct credit if using free trial
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

    // Build context
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
          if (q.answer) contextText += ` ${q.question} ${q.answer}`;
        });
      }
    } else {
      contextText = `${ideaTitle || ''} ${ideaDescription || ''}`;
    }

    if (!contextText.trim()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No search context provided'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[ENHANCED SEARCH] Context length:', contextText.length);

    // Extract smart keywords using AI
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    let searchKeywords: string[] = [];
    let queryEmbedding: number[] | null = null;

    if (OPENAI_API_KEY) {
      // Use AI to extract better search terms
      console.log('[ENHANCED SEARCH] Extracting keywords with AI');
      try {
        const keywordResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: 'Extract 5-8 specific technical keywords for patent search from the invention description. Return ONLY a JSON array of keywords, no explanation. Focus on: core technology, methods, components, applications.' 
              },
              { role: 'user', content: contextText.substring(0, 3000) }
            ],
            temperature: 0.3,
          }),
        });
        
        const keywordData = await keywordResponse.json();
        const keywordText = keywordData.choices?.[0]?.message?.content || '[]';
        try {
          searchKeywords = JSON.parse(keywordText.replace(/```json\n?|\n?```/g, ''));
        } catch {
          searchKeywords = extractKeywords(contextText);
        }
      } catch (e) {
        console.error('[ENHANCED SEARCH] AI keyword extraction failed:', e);
        searchKeywords = extractKeywords(contextText);
      }

      // Generate embedding
      console.log('[ENHANCED SEARCH] Generating query embedding');
      try {
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
      } catch (e) {
        console.error('[ENHANCED SEARCH] Embedding generation failed:', e);
      }
    } else {
      searchKeywords = extractKeywords(contextText);
    }

    console.log('[ENHANCED SEARCH] Keywords:', searchKeywords.slice(0, 5));

    // Search multiple sources in parallel
    const [patentsViewResults, lensResults] = await Promise.all([
      searchPatentsView(searchKeywords, contextText),
      searchLensAPI(contextText),
    ]);

    console.log(`[ENHANCED SEARCH] PatentsView: ${patentsViewResults.length}, Lens: ${lensResults.length}`);

    // Combine results
    const allResults = [
      ...patentsViewResults.map(r => ({ ...r, source: 'USPTO' })),
      ...lensResults.map(r => ({ ...r, source: 'Lens.org' }))
    ];

    // Deduplicate by patent number
    const seen = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      const key = r.publication_number?.toLowerCase() || r.title?.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Score and rank results
    const rankedResults = [];
    for (const result of uniqueResults.slice(0, 20)) {
      let semanticScore = 0;
      let keywordScore = calculateKeywordMatch(contextText, `${result.title} ${result.summary}`);

      // Calculate semantic similarity if we have embeddings
      if (queryEmbedding && OPENAI_API_KEY) {
        try {
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
            semanticScore = cosineSimilarity(queryEmbedding, resultEmbedding);
          }
        } catch (e) {
          console.error('[ENHANCED SEARCH] Result embedding failed:', e);
        }
      }

      // Combined score: semantic (70%) + keyword (30%)
      const finalScore = semanticScore > 0 
        ? (semanticScore * 0.7) + (keywordScore * 0.3)
        : keywordScore;

      // Generate AI analysis for overlap/differences
      let overlapClaims: string[] = [];
      let differenceClaims: string[] = [];

      if (OPENAI_API_KEY && finalScore > 0.3) {
        try {
          const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { 
                  role: 'system', 
                  content: `Analyze patent overlap. Return JSON: {"overlaps":["..."],"differences":["..."]}. 2-4 items each. Be specific and technical.`
                },
                { 
                  role: 'user', 
                  content: `USER INVENTION:\n${contextText.substring(0, 1500)}\n\nEXISTING PATENT:\nTitle: ${result.title}\nAbstract: ${result.summary}` 
                }
              ],
              temperature: 0.3,
            }),
          });
          
          const analysisData = await analysisResponse.json();
          const analysisText = analysisData.choices?.[0]?.message?.content || '{}';
          try {
            const parsed = JSON.parse(analysisText.replace(/```json\n?|\n?```/g, ''));
            overlapClaims = parsed.overlaps || [];
            differenceClaims = parsed.differences || [];
          } catch {}
        } catch (e) {
          console.error('[ENHANCED SEARCH] Analysis failed:', e);
        }
      }

      if (overlapClaims.length === 0) {
        overlapClaims = generateGenericOverlaps(result.title, contextText);
      }
      if (differenceClaims.length === 0) {
        differenceClaims = generateGenericDifferences(result.title, contextText);
      }

      rankedResults.push({
        ...result,
        similarity_score: Math.min(finalScore, 0.99),
        semantic_score: semanticScore,
        keyword_score: keywordScore,
        overlap_claims: overlapClaims,
        difference_claims: differenceClaims,
      });
    }

    // Sort by score
    rankedResults.sort((a, b) => b.similarity_score - a.similarity_score);

    // Store results
    if (session_id && rankedResults.length > 0) {
      await supabaseClient
        .from('prior_art_results')
        .delete()
        .eq('session_id', session_id);

      const resultsToStore = rankedResults.slice(0, 15).map(result => ({
        session_id,
        title: result.title,
        publication_number: result.publication_number,
        summary: result.summary,
        similarity_score: result.similarity_score,
        semantic_score: result.semantic_score,
        keyword_score: result.keyword_score,
        url: result.url,
        source: result.source,
        patent_date: result.patent_date,
        assignee: result.assignee,
        overlap_claims: result.overlap_claims,
        difference_claims: result.difference_claims,
      }));

      await supabaseClient.from('prior_art_results').insert(resultsToStore);
    }

    console.log(`[ENHANCED SEARCH] Complete: ${rankedResults.length} results, top score: ${rankedResults[0]?.similarity_score || 0}`);

    return new Response(JSON.stringify({
      success: true,
      results: rankedResults.slice(0, 15),
      results_found: rankedResults.length,
      sources_used: ['USPTO', 'Lens.org'],
      keywords_used: searchKeywords.slice(0, 5),
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

// PatentsView API v2 - USPTO patents (new endpoint)
async function searchPatentsView(keywords: string[], context: string): Promise<any[]> {
  try {
    const topKeywords = keywords.slice(0, 5);
    
    // Build query for new API format
    const searchTerms = topKeywords.length > 0 
      ? topKeywords.join(' OR ')
      : context.split(' ').slice(0, 5).join(' ');

    // New PatentsView API endpoint
    const query = {
      "_or": [
        { "_text_any": { "patent_title": searchTerms } },
        { "_text_any": { "patent_abstract": searchTerms } }
      ]
    };

    const url = `https://search.patentsview.org/api/v1/patent/`;
    const params = new URLSearchParams({
      q: JSON.stringify(query),
      f: JSON.stringify(["patent_id", "patent_title", "patent_abstract", "patent_date", "assignees"]),
      o: JSON.stringify({ size: 15 }),
      s: JSON.stringify([{ patent_date: "desc" }])
    });

    console.log('[PatentsView v2] Searching:', searchTerms.substring(0, 50));
    
    const response = await fetch(`${url}?${params}`, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PatentsView v2] API error:', response.status, errorText.substring(0, 200));
      // Fallback to Google Patents scraping
      return await searchGooglePatentsFallback(topKeywords);
    }

    const data = await response.json();
    console.log('[PatentsView v2] Found:', data.patents?.length || 0, 'results');
    
    return (data.patents || []).map((p: any) => ({
      title: p.patent_title || 'Untitled Patent',
      publication_number: `US${p.patent_id}`,
      summary: p.patent_abstract || 'No abstract available',
      url: `https://patents.google.com/patent/US${p.patent_id}`,
      patent_date: p.patent_date,
      assignee: p.assignees?.[0]?.assignee_organization || 'Unknown'
    }));
  } catch (error) {
    console.error('[PatentsView v2] Error:', error);
    return await searchGooglePatentsFallback(keywords);
  }
}

// Fallback: Use Google Patents via SerpAPI or direct search
async function searchGooglePatentsFallback(keywords: string[]): Promise<any[]> {
  try {
    const searchQuery = keywords.slice(0, 3).join(' ');
    console.log('[Google Patents Fallback] Searching:', searchQuery);
    
    // Use a simple approach - construct Google Patents URLs
    // In production, you'd want SerpAPI or similar
    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    
    if (SERPAPI_KEY) {
      const url = `https://serpapi.com/search.json?engine=google_patents&q=${encodeURIComponent(searchQuery)}&api_key=${SERPAPI_KEY}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        return (data.organic_results || []).slice(0, 10).map((r: any) => ({
          title: r.title || 'Untitled Patent',
          publication_number: r.patent_id || r.publication_number || 'Unknown',
          summary: r.snippet || 'No abstract available',
          url: r.pdf || r.link || `https://patents.google.com/patent/${r.patent_id}`,
          patent_date: r.filing_date || r.publication_date,
          assignee: r.assignee || 'Unknown'
        }));
      }
    }
    
    // No SerpAPI - return empty, Lens might still work
    console.log('[Google Patents Fallback] No SERPAPI_KEY configured');
    return [];
  } catch (error) {
    console.error('[Google Patents Fallback] Error:', error);
    return [];
  }
}

// Lens.org API (optional - needs LENS_API_KEY)
async function searchLensAPI(query: string): Promise<any[]> {
  const LENS_API_KEY = Deno.env.get('LENS_API_KEY');
  
  if (!LENS_API_KEY) {
    console.log('[Lens] No API key configured, skipping');
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
        query: {
          match: query.substring(0, 500)
        },
        size: 10,
        sort: [{ date_published: "desc" }]
      })
    });

    if (!response.ok) {
      console.error('[Lens] API error:', response.status, '- skipping');
      return [];
    }

    const data = await response.json();
    console.log('[Lens] Found:', data.data?.length || 0, 'results');
    
    return (data.data || []).map((p: any) => ({
      title: p.title || 'Untitled Patent',
      publication_number: p.lens_id || p.publication_number || 'Unknown',
      summary: p.abstract || 'No abstract available',
      url: `https://lens.org/lens/patent/${p.lens_id}`,
      patent_date: p.date_published,
      assignee: p.applicants?.[0]?.extracted_name || 'Unknown'
    }));
  } catch (error) {
    console.error('[Lens] Error:', error);
    return [];
  }
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 
    'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just',
    'should', 'now', 'also', 'which', 'what', 'this', 'that', 'these', 'those',
    'using', 'system', 'method', 'device', 'apparatus', 'process', 'based'
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  
  // Count frequency and get unique technical terms
  const freq: { [key: string]: number } = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(e => e[0]);
}

function calculateKeywordMatch(query: string, text: string): number {
  const queryKeywords = new Set(extractKeywords(query).slice(0, 15));
  const textKeywords = new Set(extractKeywords(text));
  
  let matches = 0;
  queryKeywords.forEach(k => {
    if (textKeywords.has(k)) matches++;
  });
  
  return queryKeywords.size > 0 ? matches / queryKeywords.size : 0;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

function generateGenericOverlaps(patentTitle: string, userContext: string): string[] {
  const titleWords = patentTitle.toLowerCase().split(/\s+/);
  const contextWords = userContext.toLowerCase().split(/\s+/);
  const common = titleWords.filter(w => w.length > 4 && contextWords.includes(w));
  
  if (common.length > 0) {
    return [
      `Both address ${common[0]} technology`,
      `Similar application domain`
    ];
  }
  return ['General technology overlap'];
}

function generateGenericDifferences(patentTitle: string, userContext: string): string[] {
  return [
    'Your invention may have novel implementation approach',
    'Specific technical implementation may differ',
    'Target use case differentiation possible'
  ];
}
