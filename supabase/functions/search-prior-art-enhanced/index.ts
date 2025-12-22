import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

// FREE_SEARCHES_LIMIT - synced with src/lib/pricingConstants.ts
const FREE_SEARCHES_LIMIT = 3;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, ideaTitle, ideaDescription, search_query } = await req.json();
    
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

    const isAdmin = !!adminRole;

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
        .insert({ user_id: user.id, searches_used: 0, free_searches_remaining: FREE_SEARCHES_LIMIT })
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

    // Build context - prefer search_query if provided, otherwise build from session/idea
    let contextText = search_query?.trim() || '';
    
    if (!contextText && session_id) {
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
    }
    
    if (!contextText) {
      contextText = `${ideaTitle || ''} ${ideaDescription || ''}`;
    }

    if (!contextText.trim()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No search context provided'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[ENHANCED SEARCH] Context length:', contextText.length);

    // Extract keywords for fallback searches
    const searchKeywords = extractKeywords(contextText);
    console.log('[ENHANCED SEARCH] Keywords:', searchKeywords.slice(0, 5));

    // Search multiple sources in parallel - prioritize Perplexity for best results
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    console.log('[ENHANCED SEARCH] Available APIs:', {
      perplexity: !!PERPLEXITY_API_KEY,
      firecrawl: !!FIRECRAWL_API_KEY,
      openai: !!OPENAI_API_KEY
    });

    // Run searches in parallel (Perplexity + Google Patents only)
    const [perplexityResults, googlePatentsResults] = await Promise.all([
      searchWithPerplexity(contextText, PERPLEXITY_API_KEY),
      searchGooglePatents(searchKeywords, contextText, FIRECRAWL_API_KEY),
    ]);

    console.log(`[ENHANCED SEARCH] Results - Perplexity: ${perplexityResults.length}, Google: ${googlePatentsResults.length}`);

    // Combine results - prioritize Perplexity as it has best grounded data
    const allResults = [
      ...perplexityResults.map(r => ({ ...r, source: 'Perplexity AI' })),
      ...googlePatentsResults.map(r => ({ ...r, source: 'Google Patents' })),
    ];

    // Deduplicate by patent number or title
    const seen = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      const key = (r.publication_number || r.title || '').toLowerCase().replace(/\s+/g, '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Score and analyze results
    const rankedResults = [];
    for (const result of uniqueResults.slice(0, 20)) {
      let keywordScore = calculateKeywordMatch(contextText, `${result.title} ${result.summary}`);
      
      // Boost Perplexity results as they're more relevant
      if (result.source === 'Perplexity AI') {
        keywordScore = Math.min(keywordScore * 1.2, 0.95);
      }

      // Generate overlap/difference analysis
      let overlapClaims: string[] = result.overlap_claims || [];
      let differenceClaims: string[] = result.difference_claims || [];

      // Use OpenAI for detailed analysis if available and score is high
      if (OPENAI_API_KEY && keywordScore > 0.25 && overlapClaims.length === 0) {
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
                  content: `Analyze patent overlap. Return JSON only: {"overlaps":["specific overlap 1","specific overlap 2"],"differences":["key difference 1","key difference 2"]}. 2-4 items each. Be specific and technical.`
                },
                { 
                  role: 'user', 
                  content: `USER INVENTION:\n${contextText.substring(0, 1500)}\n\nEXISTING PATENT:\nTitle: ${result.title}\nAbstract: ${result.summary}` 
                }
              ],
              temperature: 0.3,
            }),
          });
          
          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json();
            const analysisText = analysisData.choices?.[0]?.message?.content || '{}';
            try {
              const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                overlapClaims = parsed.overlaps || [];
                differenceClaims = parsed.differences || [];
              }
            } catch {}
          }
        } catch (e) {
          console.error('[ENHANCED SEARCH] Analysis failed:', e);
        }
      }

      // Fallback to generic analysis
      if (overlapClaims.length === 0) {
        overlapClaims = generateGenericOverlaps(result.title, contextText);
      }
      if (differenceClaims.length === 0) {
        differenceClaims = generateGenericDifferences(result.title, contextText);
      }

      rankedResults.push({
        ...result,
        similarity_score: Math.min(keywordScore, 0.99),
        semantic_score: keywordScore,
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

    const sourcesUsed = [];
    if (perplexityResults.length > 0) sourcesUsed.push('Perplexity AI');
    if (googlePatentsResults.length > 0) sourcesUsed.push('Google Patents');

    console.log(`[ENHANCED SEARCH] Complete: ${rankedResults.length} results, top score: ${rankedResults[0]?.similarity_score || 0}`);

    return new Response(JSON.stringify({
      success: true,
      results: rankedResults.slice(0, 15),
      results_found: rankedResults.length,
      sources_used: sourcesUsed,
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

// PRIMARY: Perplexity AI for grounded patent search - BEST RESULTS
async function searchWithPerplexity(context: string, apiKey: string | undefined): Promise<any[]> {
  if (!apiKey) {
    console.log('[Perplexity] No API key configured, skipping');
    return [];
  }

  try {
    console.log('[Perplexity] Searching for prior art...');
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are a patent search expert. Find real, existing patents that are similar to the user's invention idea. 

Return ONLY a JSON array of patents in this exact format:
[
  {
    "title": "Exact patent title",
    "publication_number": "US patent number like US10123456B2 or US2020/0123456A1",
    "summary": "Brief description of what the patent covers",
    "assignee": "Company or person who owns the patent",
    "patent_date": "Publication date YYYY-MM-DD format if known",
    "url": "Link to Google Patents or USPTO",
    "overlap_claims": ["Specific way this patent overlaps with the invention"],
    "difference_claims": ["Key difference from the user's invention"]
  }
]

Search USPTO, Google Patents, and other patent databases. Return 5-10 REAL patents. Only include patents that actually exist - never make up patent numbers.`
          },
          {
            role: 'user',
            content: `Find existing patents similar to this invention:\n\n${context.substring(0, 3000)}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('[Perplexity] API error:', response.status);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('[Perplexity] Raw response length:', content.length);

    // Extract JSON array from response
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const patents = JSON.parse(jsonMatch[0]);
        console.log('[Perplexity] Parsed patents:', patents.length);
        
        return patents.filter((p: any) => p.title && (p.publication_number || p.url)).map((p: any) => ({
          title: p.title,
          publication_number: p.publication_number || extractPatentNumber(p.url) || 'Unknown',
          summary: p.summary || p.abstract || 'No summary available',
          assignee: p.assignee || 'Unknown',
          patent_date: p.patent_date || null,
          url: p.url || `https://patents.google.com/patent/${p.publication_number}`,
          overlap_claims: p.overlap_claims || [],
          difference_claims: p.difference_claims || [],
        }));
      }
    } catch (e) {
      console.error('[Perplexity] JSON parse error:', e);
    }

    // Try to extract patents from natural language response
    const patentNumbers = content.match(/US\d{7,}[A-Z]?\d?|US\s*\d{4}\/\d{7}[A-Z]\d?|US\d{4,}\s*[A-Z]\d?/gi) || [];
    if (patentNumbers.length > 0) {
      console.log('[Perplexity] Extracted patent numbers:', patentNumbers.length);
      return [...new Set(patentNumbers)].slice(0, 10).map(num => ({
        title: `Patent ${num}`,
        publication_number: num.replace(/\s+/g, ''),
        summary: 'Found via Perplexity AI search. View patent for full details.',
        assignee: 'Unknown',
        patent_date: null,
        url: `https://patents.google.com/patent/${num.replace(/\s+/g, '')}`,
        overlap_claims: [],
        difference_claims: [],
      }));
    }

    return [];
  } catch (error) {
    console.error('[Perplexity] Error:', error);
    return [];
  }
}

function extractPatentNumber(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/US\d{7,}[A-Z]?\d?|US\d{4}\/\d{7}/i);
  return match ? match[0] : null;
}

// SECONDARY: Google Patents via Firecrawl
async function searchGooglePatents(keywords: string[], context: string, apiKey: string | undefined): Promise<any[]> {
  if (!apiKey) {
    console.log('[Google Patents] No Firecrawl API key, skipping');
    return [];
  }

  try {
    const searchTerms = keywords.slice(0, 5).join(' ');
    console.log('[Google Patents] Searching:', searchTerms.substring(0, 50));

    const googlePatentsUrl = `https://patents.google.com/?q=${encodeURIComponent(searchTerms)}&oq=${encodeURIComponent(searchTerms)}`;
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: googlePatentsUrl,
        formats: ['markdown'],
        waitFor: 5000, // Wait longer for JS to render
      }),
    });

    if (!response.ok) {
      console.error('[Google Patents] Firecrawl error:', response.status);
      return [];
    }

    const data = await response.json();
    const markdown = data.data?.markdown || '';
    
    // Parse patent results from markdown
    const patents = parseGooglePatentsMarkdown(markdown, searchTerms);
    console.log('[Google Patents] Parsed:', patents.length, 'results');
    
    return patents;
  } catch (error) {
    console.error('[Google Patents] Error:', error);
    return [];
  }
}

function parseGooglePatentsMarkdown(markdown: string, query: string): any[] {
  const results: any[] = [];
  
  // Look for patent patterns
  const patentPattern = /US\d{7,}[A-Z]?\d?|US\s*\d{4}\/\d{7}[A-Z]?\d?/gi;
  const matches = markdown.match(patentPattern) || [];
  
  // Look for titles near patent numbers
  const lines = markdown.split('\n');
  const patentLines: {number: string, title: string}[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const patentMatch = line.match(/US\d{7,}[A-Z]?\d?|US\s*\d{4}\/\d{7}[A-Z]?\d?/gi);
    if (patentMatch) {
      // Look for title in surrounding lines
      let title = '';
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
        const nearbyLine = lines[j].replace(/[#*\[\]]/g, '').trim();
        if (nearbyLine.length > 20 && nearbyLine.length < 200 && !nearbyLine.match(/US\d{7}/)) {
          title = nearbyLine;
          break;
        }
      }
      patentLines.push({ number: patentMatch[0], title });
    }
  }

  // Create results
  const seen = new Set<string>();
  for (const { number, title } of patentLines) {
    const cleanNum = number.replace(/\s+/g, '');
    if (seen.has(cleanNum)) continue;
    seen.add(cleanNum);
    
    results.push({
      title: title || `Patent related to ${query}`,
      publication_number: cleanNum,
      summary: `Patent ${cleanNum} found in search. View on Google Patents for full details.`,
      url: `https://patents.google.com/patent/${cleanNum}`,
      patent_date: null,
      assignee: 'Unknown',
      overlap_claims: [],
      difference_claims: [],
    });
  }

  return results.slice(0, 10);
}


function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 
    'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'can', 'will',
    'should', 'now', 'also', 'like', 'would', 'could', 'this', 'that', 'these',
    'those', 'which', 'what', 'who', 'whom', 'whose', 'have', 'has', 'had',
    'been', 'being', 'was', 'were', 'are', 'is', 'am', 'do', 'does', 'did',
    'done', 'doing', 'make', 'made', 'get', 'got', 'use', 'used', 'using',
    'invention', 'patent', 'method', 'system', 'device', 'apparatus', 'means',
    'comprising', 'includes', 'including', 'having', 'wherein'
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  // Count frequency
  const freq: Record<string, number> = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  // Return top keywords by frequency
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function calculateKeywordMatch(query: string, text: string): number {
  const queryKeywords = new Set(extractKeywords(query));
  const textKeywords = new Set(extractKeywords(text));
  
  if (queryKeywords.size === 0) return 0;
  
  let matches = 0;
  for (const kw of queryKeywords) {
    if (textKeywords.has(kw)) matches++;
  }
  
  return matches / queryKeywords.size;
}

function generateGenericOverlaps(patentTitle: string, context: string): string[] {
  const keywords = extractKeywords(context).slice(0, 3);
  return [
    `Both involve ${keywords[0] || 'similar technology'} concepts`,
    `Related approach to ${keywords[1] || 'the problem domain'}`,
  ];
}

function generateGenericDifferences(patentTitle: string, context: string): string[] {
  return [
    `Your invention may have a unique implementation approach`,
    `Different specific application or use case`,
  ];
}
