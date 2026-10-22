import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  requireSessionAccess, fetchWithTimeout, aiGatewayError, isUuid,
} from '../_shared/http.ts';

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const caller = await authenticate(req);
    const { session_id: rawSessionId, prior_art_id } = await readJson<{ session_id?: string; prior_art_id?: string }>(req, 16_000);
    if (!isUuid(prior_art_id)) throw new HttpError(400, 'A valid prior_art_id is required.');

    // Ownership check before using the service-role client
    const session = await requireSessionAccess(caller, rawSessionId, 'id, user_id');
    const session_id: string = session.id;
    const supabaseClient = caller.admin;

    console.log('[CLAIM CHART] Generating element-by-element comparison...');

    // Fetch latest claims section (duplicates possible: no UNIQUE(session_id, section_type))
    const { data: claimsRows } = await supabaseClient
      .from('patent_sections')
      .select('content')
      .eq('session_id', session_id)
      .eq('section_type', 'claims')
      .order('created_at', { ascending: false })
      .limit(1);
    const claimsSection = claimsRows?.[0];

    if (!claimsSection?.content) {
      throw new HttpError(409, 'Claims not found. Generate patent draft first.');
    }

    // Prior art must belong to the same (owned) session
    const { data: priorArt } = await supabaseClient
      .from('prior_art_results')
      .select('*')
      .eq('id', prior_art_id)
      .eq('session_id', session_id)
      .maybeSingle();

    if (!priorArt) {
      throw new HttpError(404, 'Prior art not found');
    }

    // Use Lovable AI to generate claim chart
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new HttpError(500, 'AI service is not configured.');
    }

    const prompt = `Create a detailed claim chart comparing patent claims to prior art.

YOUR CLAIMS:
${String(claimsSection.content).slice(0, 30000)}

PRIOR ART:
Title: ${priorArt.title}
Publication Number: ${priorArt.publication_number}
Summary: ${priorArt.summary}

Create a table with these columns:
1. Claim Element - Each element of your claim
2. Present in Prior Art? - Yes/No/Partially
3. Prior Art Disclosure - Where/how prior art discloses this element
4. Differences - Key differences between your invention and prior art

Format as a structured table. Focus on independent claim 1 first, then dependent claims.

Also provide:
- Overall Assessment: Does prior art anticipate your claims?
- Differentiation Strategy: How to strengthen claims to avoid this prior art
- Recommendation: File as-is, amend claims, or abandon?`;

    const response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'You are a patent attorney creating claim charts. Be thorough and objective in comparing claims to prior art.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 3000
      }),
    }, 90_000);

    if (!response.ok) throw await aiGatewayError(response, 'generate-claim-chart');

    const data = await response.json().catch(() => null);
    const claimChart = String(data?.choices?.[0]?.message?.content ?? '');
    if (!claimChart.trim()) throw new HttpError(502, 'Failed to generate claim chart');

    // Store parsed overlaps/differences, but never wipe existing ones with an empty parse
    const overlaps = extractOverlapClaims(claimChart);
    const differences = extractDifferenceClaims(claimChart);
    const update: Record<string, string[]> = {};
    if (overlaps.length) update.overlap_claims = overlaps;
    if (differences.length) update.difference_claims = differences;
    if (Object.keys(update).length) {
      const { error: updErr } = await supabaseClient.from('prior_art_results').update(update).eq('id', prior_art_id);
      if (updErr) console.warn('[CLAIM CHART] Failed to store overlaps:', updErr.message);
    }

    console.log('[CLAIM CHART] Generated successfully');

    return jsonResponse({
      success: true,
      claim_chart: claimChart,
      prior_art_id: prior_art_id
    });

  } catch (error) {
    return errorResponse(error, 'Failed to generate claim chart', 'generate-claim-chart');
  }
});

function extractOverlapClaims(chart: string): string[] {
  // Extract elements marked as "Yes" or "Partially" in prior art
  const overlaps: string[] = [];
  const lines = chart.split('\n');
  
  for (const line of lines) {
    if (line.includes('Yes') || line.includes('Partially')) {
      // Extract claim element (rough parsing)
      const match = line.match(/\d+\.\s*(.+?)\s*\|/);
      if (match) {
        overlaps.push(match[1].trim());
      }
    }
  }
  
  return overlaps.slice(0, 10); // Top 10
}

function extractDifferenceClaims(chart: string): string[] {
  // Extract elements marked as "No" in prior art
  const differences: string[] = [];
  const lines = chart.split('\n');
  
  for (const line of lines) {
    if (line.includes('| No |') || line.includes('not disclosed')) {
      const match = line.match(/\d+\.\s*(.+?)\s*\|/);
      if (match) {
        differences.push(match[1].trim());
      }
    }
  }
  
  return differences.slice(0, 10); // Top 10
}