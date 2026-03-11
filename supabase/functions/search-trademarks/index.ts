import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

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
    const { mark_name, mark_description, nice_classes } = await req.json();

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
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;
    // Fetch full user for email if needed
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    console.log('[TRADEMARK SEARCH] Starting for mark:', mark_name);

    // Admin check
    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    const isAdmin = !!adminRole;

    // Check subscription
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    const hasActiveSubscription = !!subscription || isAdmin;

    // Check credits
    let { data: credits } = await supabaseClient
      .from('user_search_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!credits) {
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

    // Deduct credit if free trial
    if (!hasActiveSubscription && hasCredits) {
      await supabaseClient.rpc('decrement_search_credit', { _user_id: user.id });
    }

    // Create search record
    const { data: searchRecord, error: searchError } = await supabaseClient
      .from('trademark_searches')
      .insert({
        user_id: user.id,
        mark_name: mark_name.trim(),
        mark_description: mark_description?.trim() || null,
        nice_classes: nice_classes || [],
        search_type: 'wordmark',
      })
      .select()
      .single();

    if (searchError) throw new Error('Failed to create search record');

    // Search with Perplexity
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    const results = await searchTrademarksWithPerplexity(
      mark_name.trim(),
      mark_description || '',
      nice_classes || [],
      PERPLEXITY_API_KEY
    );

    console.log(`[TRADEMARK SEARCH] Perplexity returned ${results.length} results`);

    // Analyze conflicts with OpenAI
    const analyzedResults = [];
    for (const result of results.slice(0, 20)) {
      let conflictAnalysis = result.conflict_analysis || [];
      let differentiationPoints = result.differentiation_points || [];

      if (OPENAI_API_KEY && conflictAnalysis.length === 0) {
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
                  content: 'Analyze trademark conflict likelihood. Return JSON only: {"conflicts":["specific conflict 1","specific conflict 2"],"differentiators":["key difference 1","key difference 2"]}. 2-3 items each. Be specific about likelihood of confusion.'
                },
                {
                  role: 'user',
                  content: `NEW MARK: "${mark_name}" - ${mark_description || 'No description'}\nNice Classes: ${(nice_classes || []).join(', ') || 'Not specified'}\n\nEXISTING MARK: "${result.mark_name}" owned by ${result.owner || 'Unknown'}\nGoods/Services: ${result.goods_services || 'Unknown'}\nNice Classes: ${(result.nice_classes || []).join(', ') || 'Unknown'}`
                }
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
                conflictAnalysis = parsed.conflicts || [];
                differentiationPoints = parsed.differentiators || [];
              }
            } catch {}
          }
        } catch (e) {
          console.error('[TRADEMARK] Analysis error:', e);
        }
      }

      // Calculate similarity
      const similarity = calculateMarkSimilarity(mark_name, result.mark_name || '');

      analyzedResults.push({
        search_id: searchRecord.id,
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
        source: result.source || 'USPTO',
        url: result.url,
      });
    }

    // Sort by similarity
    analyzedResults.sort((a, b) => b.similarity_score - a.similarity_score);

    // Store results
    if (analyzedResults.length > 0) {
      await supabaseClient
        .from('trademark_results')
        .insert(analyzedResults.slice(0, 15));
    }

    // Update search record
    await supabaseClient
      .from('trademark_searches')
      .update({ results_count: analyzedResults.length })
      .eq('id', searchRecord.id);

    console.log(`[TRADEMARK SEARCH] Complete: ${analyzedResults.length} results`);

    return new Response(JSON.stringify({
      success: true,
      search_id: searchRecord.id,
      results: analyzedResults.slice(0, 15),
      results_found: analyzedResults.length,
      search_credits_remaining: hasActiveSubscription ? 'unlimited' : Math.max(0, (credits?.free_searches_remaining || 1) - 1),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TRADEMARK SEARCH] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function searchTrademarksWithPerplexity(
  markName: string,
  description: string,
  niceClasses: string[],
  apiKey: string | undefined
): Promise<any[]> {
  if (!apiKey) {
    console.log('[Perplexity TM] No API key, skipping');
    return [];
  }

  try {
    const classInfo = niceClasses.length > 0
      ? `Nice Classification classes: ${niceClasses.join(', ')}`
      : 'All relevant classes';

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `You are a trademark attorney conducting a comprehensive trademark clearance search. Your task is to find REAL, EXISTING trademarks registered with the USPTO that could conflict with a proposed mark.

CRITICAL SEARCH INSTRUCTIONS:
1. Search the USPTO TESS (Trademark Electronic Search System) database
2. Look for marks that are phonetically similar, visually similar, or have similar meaning
3. Focus on marks in the same or related Nice Classification classes
4. Include both LIVE and DEAD marks (dead marks still inform clearance)
5. Consider common law trademarks and state registrations
6. Look for marks from major brands AND small businesses

LIKELIHOOD OF CONFUSION FACTORS (DuPont factors):
- Similarity of marks (sound, appearance, meaning)
- Similarity of goods/services
- Strength of the prior mark
- Evidence of actual confusion
- Channels of trade

OUTPUT FORMAT - Return ONLY a valid JSON array:
[
  {
    "mark_name": "Exact registered trademark name",
    "registration_number": "USPTO registration number (e.g., 1234567)",
    "serial_number": "USPTO serial number (e.g., 88123456)",
    "status": "LIVE or DEAD",
    "owner": "Trademark owner name",
    "filing_date": "YYYY-MM-DD",
    "registration_date": "YYYY-MM-DD or null if pending",
    "nice_classes": ["009", "042"],
    "goods_services": "Brief description of goods/services",
    "conflict_analysis": ["Specific conflict reason 1", "Specific conflict reason 2"],
    "differentiation_points": ["Key difference 1", "Key difference 2"],
    "url": "https://tsdr.uspto.gov/#caseNumber=XXXXXXX&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch"
  }
]

MANDATORY: Only include trademarks you can verify exist in USPTO records. Never fabricate registration numbers. Include 5-15 potentially conflicting marks.`
          },
          {
            role: 'user',
            content: `PROPOSED TRADEMARK TO CLEAR:

Mark Name: "${markName}"
Description: ${description || 'Not provided'}
${classInfo}

Find existing USPTO trademarks that could block registration of this mark. Focus on:
1. Identical or nearly identical marks
2. Phonetically similar marks (sound-alikes)
3. Marks with similar meaning or commercial impression
4. Marks in the same or related goods/services classes`
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('[Perplexity TM] API error:', response.status);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const marks = JSON.parse(jsonMatch[0]);
        return marks.filter((m: any) => m.mark_name).map((m: any) => ({
          mark_name: m.mark_name,
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
          source: 'USPTO',
          url: m.url || (m.serial_number
            ? `https://tsdr.uspto.gov/#caseNumber=${m.serial_number}&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch`
            : null),
        }));
      }
    } catch (e) {
      console.error('[Perplexity TM] JSON parse error:', e);
    }

    return [];
  } catch (error) {
    console.error('[Perplexity TM] Error:', error);
    return [];
  }
}

function calculateMarkSimilarity(mark1: string, mark2: string): number {
  const a = mark1.toLowerCase().trim();
  const b = mark2.toLowerCase().trim();

  if (a === b) return 0.99;

  // Levenshtein-based similarity
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  const distance = levenshtein(a, b);
  const levSimilarity = 1 - (distance / maxLen);

  // Starts-with bonus
  let prefixBonus = 0;
  const minLen = Math.min(a.length, b.length);
  let commonPrefix = 0;
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) commonPrefix++;
    else break;
  }
  prefixBonus = (commonPrefix / maxLen) * 0.15;

  // Containment bonus
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
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
