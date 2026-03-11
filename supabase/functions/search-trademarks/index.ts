import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const FREE_SEARCHES_LIMIT = 3;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mark_name, mark_description, nice_classes, skip_credit_check } = await req.json();

    if (!mark_name?.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'Trademark name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const isServiceCall = skip_credit_check && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    let userId: string | null = null;
    let hasActiveSubscription = false;
    let creditsRemaining: number | null = null;

    if (!isServiceCall) {
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = userData.user.id;
      console.log('[TRADEMARK SEARCH] Starting for mark:', mark_name, 'user:', userId);

      const { data: adminRole } = await supabaseClient
        .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
      const isAdmin = !!adminRole;

      const { data: subscription } = await supabaseClient
        .from('subscriptions').select('*').eq('user_id', userId).eq('status', 'active').maybeSingle();
      hasActiveSubscription = !!subscription || isAdmin;

      let { data: credits } = await supabaseClient
        .from('user_search_credits').select('*').eq('user_id', userId).maybeSingle();

      if (!credits) {
        const { data: newCredits, error: createError } = await supabaseClient
          .from('user_search_credits')
          .insert({ user_id: userId, searches_used: 0, free_searches_remaining: FREE_SEARCHES_LIMIT })
          .select().single();
        if (createError) throw new Error('Failed to initialize search credits');
        credits = newCredits;
      }

      const hasCredits = credits && credits.free_searches_remaining > 0;
      creditsRemaining = credits?.free_searches_remaining ?? 0;

      if (!hasActiveSubscription && !hasCredits) {
        return new Response(JSON.stringify({
          success: false, error: 'No search credits remaining. Please subscribe to continue.',
          requires_subscription: true
        }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!hasActiveSubscription && hasCredits) {
        await supabaseClient.rpc('decrement_search_credit', { _user_id: userId });
        creditsRemaining = Math.max(0, (creditsRemaining ?? 1) - 1);
      }
    } else {
      console.log('[TRADEMARK SEARCH] Service call - skipping auth/credits for mark:', mark_name);
    }

    // Create search record
    let searchRecord: any = null;
    if (!isServiceCall && userId) {
      const { data, error: searchError } = await supabaseClient
        .from('trademark_searches')
        .insert({
          user_id: userId, mark_name: mark_name.trim(),
          mark_description: mark_description?.trim() || null,
          nice_classes: nice_classes || [], search_type: 'wordmark',
        }).select().single();
      if (searchError) throw new Error('Failed to create search record');
      searchRecord = data;
    }

    // ========== MULTI-SOURCE TRADEMARK SEARCH ==========
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    const classInfo = (nice_classes || []).length > 0 ? nice_classes.join(', ') : '';
    const trimmedName = mark_name.trim();

    // Run searches in parallel
    const [perplexityResults, firecrawlResults, trademarkiaResults] = await Promise.all([
      searchWithPerplexity(trimmedName, mark_description || '', nice_classes || [], PERPLEXITY_API_KEY),
      searchWithFirecrawl(trimmedName, classInfo, FIRECRAWL_API_KEY),
      scrapeTrademarkia(trimmedName, classInfo, FIRECRAWL_API_KEY),
    ]);

    console.log(`[TRADEMARK SEARCH] Sources: Perplexity=${perplexityResults.length}, Firecrawl=${firecrawlResults.length}, Trademarkia=${trademarkiaResults.length}`);

    // Merge and deduplicate
    const allResults = [...perplexityResults, ...firecrawlResults, ...trademarkiaResults];
    const deduped = deduplicateResults(allResults);

    // Analyze conflicts with OpenAI
    const analyzedResults = [];
    for (const result of deduped.slice(0, 20)) {
      let conflictAnalysis = result.conflict_analysis || [];
      let differentiationPoints = result.differentiation_points || [];

      if (OPENAI_API_KEY) {
        try {
          const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: `You are a USPTO trademark attorney analyzing likelihood of confusion between two marks. Apply the DuPont factors:

1. Similarity of marks (sight, sound, meaning)
2. Relatedness of goods/services
3. Similarity of trade channels
4. Conditions of purchase (sophisticated vs impulse buyers)
5. Fame of the existing mark
6. Actual confusion evidence

Return JSON only:
{
  "verdict": "HIGH_RISK" | "MODERATE_RISK" | "LOW_RISK" | "LIKELY_CLEAR",
  "verdict_summary": "One sentence explaining whether this mark would likely block registration and why",
  "likelihood_of_confusion": "A 2-3 sentence attorney-style assessment of whether USPTO would find likelihood of confusion",
  "conflicts": ["specific DuPont factor concern 1", "specific concern 2"],
  "differentiators": ["key legal difference that helps the applicant 1", "difference 2"],
  "recommendation": "One clear action item: e.g. 'Proceed with caution' or 'Consider a different name' or 'Low risk - different industry'"
}

Be honest and practical. If marks are in completely different industries with different consumers, say so. Dead/abandoned marks are lower risk. Different Nice classes with unrelated goods = lower risk.` },
                { role: 'user', content: `NEW MARK: "${mark_name}" for: ${mark_description || 'No description provided'}\nNice Classes: ${classInfo || 'Not specified'}\n\nEXISTING MARK: "${result.mark_name}" owned by ${result.owner || 'Unknown'}\nStatus: ${result.status || 'Unknown'}\nGoods/Services: ${result.goods_services || 'Unknown'}\nNice Classes: ${(result.nice_classes || []).join(', ') || 'Unknown'}` }
              ],
              temperature: 0.3,
            }),
          });
          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json();
            const text = analysisData.choices?.[0]?.message?.content || '{}';
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                conflictAnalysis = parsed.conflicts || conflictAnalysis;
                differentiationPoints = parsed.differentiators || differentiationPoints;
                result._verdict = parsed.verdict || null;
                result._verdict_summary = parsed.verdict_summary || null;
                result._likelihood = parsed.likelihood_of_confusion || null;
                result._recommendation = parsed.recommendation || null;
              }
            } catch {}
          }
        } catch (e) {
          console.error('[TRADEMARK] Analysis error:', e);
        }
      }

      const similarity = calculateMarkSimilarity(mark_name, result.mark_name || '');
      const resultEntry: any = {
        mark_name: result.mark_name,
        registration_number: result.registration_number,
        serial_number: result.serial_number,
        status: result.status,
        owner: result.owner,
        filing_date: result.filing_date,
        registration_date: result.registration_date,
        nice_classes: result.nice_classes || [],
        goods_services: result.goods_services,
        similarity_score: similarity,
        conflict_analysis: conflictAnalysis,
        differentiation_points: differentiationPoints,
        verdict: result._verdict || null,
        verdict_summary: result._verdict_summary || null,
        likelihood_of_confusion: result._likelihood || null,
        recommendation: result._recommendation || null,
        source: result.source || 'USPTO',
        url: result.url,
      };
      if (searchRecord) resultEntry.search_id = searchRecord.id;
      analyzedResults.push(resultEntry);
    }

    analyzedResults.sort((a, b) => b.similarity_score - a.similarity_score);

    if (searchRecord && analyzedResults.length > 0) {
      await supabaseClient.from('trademark_results').insert(analyzedResults.slice(0, 15));
      await supabaseClient.from('trademark_searches').update({ results_count: analyzedResults.length }).eq('id', searchRecord.id);
    }

    console.log(`[TRADEMARK SEARCH] Complete: ${analyzedResults.length} results`);

    return new Response(JSON.stringify({
      success: true,
      search_id: searchRecord?.id || null,
      results: analyzedResults.slice(0, 15),
      results_found: analyzedResults.length,
      search_credits_remaining: isServiceCall ? 'unlimited' : (hasActiveSubscription ? 'unlimited' : creditsRemaining),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[TRADEMARK SEARCH] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ==================== SOURCE 1: PERPLEXITY ====================
async function searchWithPerplexity(markName: string, description: string, niceClasses: string[], apiKey: string | undefined): Promise<any[]> {
  if (!apiKey) return [];

  try {
    const classInfo = niceClasses.length > 0 ? `Nice classes: ${niceClasses.join(', ')}` : '';

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `You are a trademark research assistant. Search the web for existing trademarks and brands that could conflict with a proposed mark.

SEARCH APPROACH:
1. Search for companies, products, and brands using this name or similar names
2. Look for USPTO trademark registrations on Trademarkia, USPTO TSDR, or other public records
3. Include well-known brands with similar names in similar industries
4. Include both registered trademarks AND well-known unregistered brands

CRITICAL: Return ONLY a raw JSON array. No markdown code blocks. No explanation text. Just the array.

[
  {
    "mark_name": "Name of existing brand/trademark",
    "registration_number": "Registration number if known, or null",
    "serial_number": "Serial number if known, or null",
    "status": "LIVE or DEAD or ACTIVE",
    "owner": "Company or person who owns it",
    "filing_date": null,
    "registration_date": null,
    "nice_classes": ["009"],
    "goods_services": "What the brand sells or does",
    "conflict_analysis": ["Why this conflicts"],
    "differentiation_points": ["How it differs"],
    "url": "URL to trademark record or company website"
  }
]

Return 5-15 results. NEVER return empty array. Include well-known brands even without exact registration numbers.`
          },
          {
            role: 'user',
            content: `Find existing trademarks and brands that conflict with: "${markName}"\nDescription: ${description || 'Not provided'}\n${classInfo}\n\nSearch for companies using "${markName}" or similar names. Include ANY brand that could cause confusion.`
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Perplexity TM] API error:', response.status, errText);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('[Perplexity TM] Response length:', content.length);

    return parseJsonResults(content, 'Perplexity');
  } catch (error) {
    console.error('[Perplexity TM] Error:', error);
    return [];
  }
}

// ==================== SOURCE 2: FIRECRAWL WEB SEARCH ====================
async function searchWithFirecrawl(markName: string, classInfo: string, apiKey: string | undefined): Promise<any[]> {
  if (!apiKey) return [];

  try {
    const queries = [
      `"${markName}" trademark registration USPTO`,
      `"${markName}" brand company ${classInfo ? 'software technology' : ''}`,
    ];

    const allResults: any[] = [];

    for (const query of queries) {
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 10 }),
        });

        if (!response.ok) {
          console.error('[Firecrawl TM] Search error:', response.status);
          continue;
        }

        const data = await response.json();
        const searchResults = data?.data || data?.results || [];

        for (const item of searchResults) {
          const title = item.title || '';
          const url = item.url || '';
          const description = item.description || '';

          // Skip non-trademark pages (reviews, blog posts, articles, comparisons, pricing pages)
          if (isNonTrademarkPage(title, url)) continue;

          // Extract trademark info from Trademarkia, USPTO, or other trademark sites
          if (url.includes('trademarkia.com') || url.includes('uspto.gov') || url.includes('tmhunt.com') || url.includes('justia.com/trademarks')) {
            const extracted = extractTrademarkFromSearchResult(title, description, url, markName);
            if (extracted) allResults.push(extracted);
          }
          // Only include non-trademark-site results if they look like actual brand/company pages
          else if (isLikelyBrandPage(title, url, description, markName)) {
            allResults.push({
              mark_name: cleanMarkName(extractBrandName(title, markName), markName),
              registration_number: null,
              serial_number: extractSerialNumber(description + ' ' + title),
              status: 'ACTIVE',
              owner: extractOwner(description),
              filing_date: null,
              registration_date: null,
              nice_classes: [],
              goods_services: description.substring(0, 200),
              conflict_analysis: [],
              differentiation_points: [],
              source: 'Web Search',
              url: url,
            });
          }
        }
      } catch (e) {
        console.error('[Firecrawl TM] Query error:', e);
      }
    }

    console.log(`[Firecrawl TM] Found ${allResults.length} results`);
    return allResults;
  } catch (error) {
    console.error('[Firecrawl TM] Error:', error);
    return [];
  }
}

// ==================== SOURCE 3: TRADEMARKIA SCRAPE ====================
async function scrapeTrademarkia(markName: string, classInfo: string, apiKey: string | undefined): Promise<any[]> {
  if (!apiKey) return [];

  try {
    const searchUrl = `https://www.trademarkia.com/search?q=${encodeURIComponent(markName)}`;
    console.log('[Trademarkia] Scraping:', searchUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      console.error('[Trademarkia] Scrape error:', response.status);
      return [];
    }

    const data = await response.json();
    const markdown = data?.data?.markdown || data?.markdown || '';
    
    if (!markdown || markdown.length < 100) {
      console.log('[Trademarkia] No meaningful content scraped');
      return [];
    }

    console.log('[Trademarkia] Scraped content length:', markdown.length);
    return parseTrademarkiaResults(markdown, markName);
  } catch (error) {
    console.error('[Trademarkia] Error:', error);
    return [];
  }
}

// ==================== PARSING HELPERS ====================

function parseJsonResults(content: string, source: string): any[] {
  try {
    // Try markdown code blocks first
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    let jsonStr = '';
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) jsonStr = arrayMatch[0];
    }

    if (jsonStr) {
      const marks = JSON.parse(jsonStr);
      console.log(`[${source}] Parsed ${marks.length} marks`);
      return marks.filter((m: any) => m.mark_name).map((m: any) => ({
        mark_name: cleanMarkName(m.mark_name, m.mark_name),
        registration_number: m.registration_number || null,
        serial_number: m.serial_number || null,
        status: m.status || 'Unknown',
        owner: m.owner || 'Unknown',
        filing_date: m.filing_date || null,
        registration_date: m.registration_date || null,
        nice_classes: m.nice_classes || [],
        goods_services: m.goods_services || null,
        conflict_analysis: m.conflict_analysis || [],
        differentiation_points: m.differentiation_points || [],
        source: m.source || 'USPTO',
        url: m.url || (m.serial_number
          ? `https://tsdr.uspto.gov/#caseNumber=${m.serial_number}&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch`
          : null),
      }));
    } else {
      console.error(`[${source}] No JSON array found. Preview:`, content.substring(0, 500));
    }
  } catch (e) {
    console.error(`[${source}] JSON parse error:`, e);
  }
  return [];
}

function parseTrademarkiaResults(markdown: string, queryMark: string): any[] {
  const results: any[] = [];
  
  // Trademarkia typically shows results as lines with mark name, serial number, owner, status, class
  // Pattern: "MARK_NAME" or "Mark Name - Serial Number - Owner - Status"
  const lines = markdown.split('\n').filter(l => l.trim().length > 0);
  
  let currentMark: any = null;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Look for serial numbers (pattern: 5-8 digit numbers often prefixed with serial/SN)
    const serialMatch = trimmed.match(/(?:Serial|SN|#)\s*(?:No\.?\s*)?(\d{5,8})/i) || trimmed.match(/\b(\d{7,8})\b/);
    
    // Look for registration numbers
    const regMatch = trimmed.match(/(?:Reg|Registration)\s*(?:No\.?\s*)?(\d{5,8})/i);
    
    // Look for status indicators
    const isLive = /\b(live|active|registered)\b/i.test(trimmed);
    const isDead = /\b(dead|cancelled|abandoned|expired)\b/i.test(trimmed);
    
    // Look for class info
    const classMatch = trimmed.match(/(?:Class|IC)\s*(?:0?)(\d{1,3})/gi);
    
    // Look for mark names that could be similar to our query
    const lowerTrimmed = trimmed.toLowerCase();
    const lowerQuery = queryMark.toLowerCase();
    
    if (lowerTrimmed.includes(lowerQuery) || levenshtein(lowerTrimmed.substring(0, lowerQuery.length + 5), lowerQuery) <= 3) {
      // This line likely contains a trademark name
      if (currentMark) results.push(currentMark);
      
      currentMark = {
        mark_name: extractMarkNameFromLine(trimmed, queryMark),
        registration_number: regMatch ? regMatch[1] : null,
        serial_number: serialMatch ? serialMatch[1] : null,
        status: isLive ? 'LIVE' : isDead ? 'DEAD' : 'Unknown',
        owner: null,
        filing_date: null,
        registration_date: null,
        nice_classes: classMatch ? classMatch.map(c => c.replace(/\D/g, '').padStart(3, '0')) : [],
        goods_services: null,
        conflict_analysis: [],
        differentiation_points: [],
        source: 'Trademarkia',
        url: `https://www.trademarkia.com/search?q=${encodeURIComponent(queryMark)}`,
      };
    } else if (currentMark) {
      // Enrich current mark with additional info from subsequent lines
      if (serialMatch && !currentMark.serial_number) currentMark.serial_number = serialMatch[1];
      if (regMatch && !currentMark.registration_number) currentMark.registration_number = regMatch[1];
      if (isLive) currentMark.status = 'LIVE';
      if (isDead) currentMark.status = 'DEAD';
      if (/(?:owner|by|filed by|applicant)/i.test(trimmed)) {
        currentMark.owner = trimmed.replace(/^.*(?:owner|by|filed by|applicant)[:\s]*/i, '').trim();
      }
      if (classMatch && currentMark.nice_classes.length === 0) {
        currentMark.nice_classes = classMatch.map(c => c.replace(/\D/g, '').padStart(3, '0'));
      }
      // Capture goods/services description
      if (trimmed.length > 20 && !currentMark.goods_services && !/^\d+$/.test(trimmed)) {
        currentMark.goods_services = trimmed.substring(0, 200);
      }
    }
  }

  if (currentMark) results.push(currentMark);

  console.log(`[Trademarkia] Parsed ${results.length} results from scraped content`);
  return results.filter(r => r.mark_name);
}

function extractTrademarkFromSearchResult(title: string, description: string, url: string, queryMark: string): any | null {
  const combined = `${title} ${description}`;
  
  // Extract serial number from URL or text
  const serialFromUrl = url.match(/(\d{7,8})/);
  const serialFromText = combined.match(/(?:Serial|SN)\s*#?\s*(\d{7,8})/i);
  
  const markName = extractBrandName(title, queryMark);
  if (!markName) return null;

  return {
    mark_name: markName,
    registration_number: null,
    serial_number: serialFromUrl?.[1] || serialFromText?.[1] || null,
    status: /live|active|registered/i.test(combined) ? 'LIVE' : /dead|cancelled|abandoned/i.test(combined) ? 'DEAD' : 'Unknown',
    owner: extractOwner(description),
    filing_date: null,
    registration_date: null,
    nice_classes: [],
    goods_services: description.substring(0, 200),
    conflict_analysis: [],
    differentiation_points: [],
    source: url.includes('trademarkia') ? 'Trademarkia' : url.includes('uspto') ? 'USPTO' : 'Web',
    url: url,
  };
}

function extractBrandName(title: string, queryMark: string): string {
  // Try to extract the brand name closest to the query
  const words = title.split(/[\s\-–|:,]+/);
  const lowerQuery = queryMark.toLowerCase();
  
  // Find exact or near matches
  for (let i = 0; i < words.length; i++) {
    if (words[i].toLowerCase().includes(lowerQuery) || lowerQuery.includes(words[i].toLowerCase())) {
      // Return the word and potentially adjacent words
      const start = Math.max(0, i);
      const end = Math.min(words.length, i + 3);
      return words.slice(start, end).join(' ').replace(/[^\w\s'-]/g, '').trim();
    }
  }
  
  // Fallback: return first few meaningful words of title
  return title.split(/[\-–|:]/)[0].trim().substring(0, 50);
}

function extractOwner(text: string): string | null {
  const ownerMatch = text.match(/(?:owned by|by|owner|filed by|applicant)[:\s]+([^,.]+)/i);
  if (ownerMatch) return ownerMatch[1].trim();
  
  // Look for company-like names
  const companyMatch = text.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*(?:\s(?:Inc|LLC|Corp|Ltd|Co|Group))\.?)/);
  if (companyMatch) return companyMatch[1].trim();
  
  return null;
}

function extractSerialNumber(text: string): string | null {
  const match = text.match(/(?:Serial|SN)\s*#?\s*(\d{7,8})/i) || text.match(/\b(\d{8})\b/);
  return match ? match[1] : null;
}

function extractMarkNameFromLine(line: string, queryMark: string): string {
  // Clean up the line and extract the mark name
  let name = line.replace(/\*\*/g, '').replace(/\[.*?\]\(.*?\)/g, '').trim();
  // If line has multiple parts separated by pipes or dashes, take the first
  const parts = name.split(/[|–—]/);
  if (parts.length > 1) name = parts[0].trim();
  // Truncate if too long
  if (name.length > 60) name = name.substring(0, 60).trim();
  return name || queryMark;
}

function deduplicateResults(results: any[]): any[] {
  const seen = new Map<string, any>();
  
  for (const r of results) {
    const key = (r.mark_name || '').toLowerCase().trim();
    if (!key) continue;
    
    // If we already have this mark, merge info (prefer the one with more data)
    if (seen.has(key)) {
      const existing = seen.get(key);
      // Keep the one with more fields filled in
      const existingScore = [existing.serial_number, existing.registration_number, existing.owner, existing.goods_services].filter(Boolean).length;
      const newScore = [r.serial_number, r.registration_number, r.owner, r.goods_services].filter(Boolean).length;
      if (newScore > existingScore) {
        seen.set(key, { ...existing, ...r });
      }
    } else {
      seen.set(key, r);
    }
  }
  
  return Array.from(seen.values());
}

// ==================== FILTERING ====================
function isNonTrademarkPage(title: string, url: string): boolean {
  const lower = title.toLowerCase();
  const lowerUrl = url.toLowerCase();

  const junkPatterns = [
    /\breview[s]?\b/i, /\bpricing\b/i, /\bvs\.?\b/i, /\bcompar/i,
    /\balternative[s]?\b/i, /\bhow to\b/i, /\btutorial\b/i,
    /\bbest\s+\d/i, /\btop\s+\d/i, /\bresearch\b/i,
    /\bblog\b/i, /\bnews\b/i, /\barticle\b/i,
  ];
  if (junkPatterns.some(p => p.test(lower))) return true;

  const junkDomains = [
    'pcmag.com', 'forbes.com', 'capterra.com', 'g2.com', 'trustpilot.com',
    'outsail.co', 'businesswire.com', 'prnewswire.com', 'techcrunch.com',
    'linkedin.com', 'twitter.com', 'facebook.com', 'youtube.com',
    'reddit.com', 'quora.com', 'medium.com', 'wikipedia.org',
    'indeed.com', 'glassdoor.com',
  ];
  if (junkDomains.some(d => lowerUrl.includes(d))) return true;

  return false;
}

function isLikelyBrandPage(title: string, url: string, description: string, queryMark: string): boolean {
  const lower = title.toLowerCase();
  const lowerQuery = queryMark.toLowerCase();
  if (!lower.includes(lowerQuery)) return false;
  const isOwnDomain = url.toLowerCase().includes(lowerQuery.replace(/\s+/g, ''));
  const hasTrademark = /trademark|registration|serial|filing/i.test(description);
  return isOwnDomain || hasTrademark;
}

function cleanMarkName(name: string, queryMark: string): string {
  if (!name) return queryMark;
  let cleaned = name;
  // Remove bracket prefixes like [PDF], [DOC], [XLS], [PPT], [HTML], etc.
  cleaned = cleaned.replace(/^\s*\[[A-Z]{2,5}\]\s*/gi, '');
  // Remove trailing bracket tags
  cleaned = cleaned.replace(/\s*\[[A-Z]{2,5}\]\s*$/gi, '');
  // Remove inline bracket tags
  cleaned = cleaned.replace(/\s*\[[A-Z]{2,5}\]\s*/gi, ' ');
  // Remove "..." or "…" at start/end
  cleaned = cleaned.replace(/^[.…]+|[.…]+$/g, '').trim();
  const suffixPatterns = [
    /\s+(?:review|reviews|pricing|software|app|platform|tool|service|guide|tutorial|overview|features?|comparison)\s*.*$/i,
    /\s+(?:brings?|launches?|announces?|introduces?)\s+.*$/i,
    /\s+\d{4}\s*$/,
    /\s+[-–|:].+$/,
    /\s+(?:on|at|for|from|with)\s+.*$/i,
  ];
  for (const pattern of suffixPatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }
  // Also strip common file-type words
  cleaned = cleaned.replace(/\b(?:pdf|doc|docx|xlsx|pptx?)\b/gi, '').trim();
  // Remove double spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned.length >= 2 ? cleaned : queryMark;
}

// ==================== SIMILARITY ====================
function calculateMarkSimilarity(mark1: string, mark2: string): number {
  const a = mark1.toLowerCase().trim();
  const b = mark2.toLowerCase().trim();
  if (a === b) return 0.99;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  const distance = levenshtein(a, b);
  const levSimilarity = 1 - (distance / maxLen);
  let prefixBonus = 0;
  const minLen = Math.min(a.length, b.length);
  let commonPrefix = 0;
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) commonPrefix++; else break;
  }
  prefixBonus = (commonPrefix / maxLen) * 0.15;
  let containBonus = 0;
  if (a.includes(b) || b.includes(a)) containBonus = 0.2;
  return Math.min(levSimilarity + prefixBonus + containBonus, 0.99);
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}
