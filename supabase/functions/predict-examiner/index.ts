import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  requireSessionAccess, fetchWithTimeout, aiGatewayError,
} from '../_shared/http.ts';

async function ask(apiKey: string, system: string, user: string, temperature: number, maxTokens: number): Promise<string> {
  const res = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature,
      max_tokens: maxTokens,
    }),
  }, 60_000);
  if (!res.ok) throw await aiGatewayError(res, 'predict-examiner');
  const data = await res.json().catch(() => null);
  const content = String(data?.choices?.[0]?.message?.content ?? '').trim();
  if (!content) throw new HttpError(502, 'The AI returned an empty response. Please try again.');
  return content;
}

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const caller = await authenticate(req);
    const { session_id: rawSessionId } = await readJson<{ session_id?: string }>(req, 16_000);

    // Ownership check; include data_source so the update below merges instead of wiping it
    const session = await requireSessionAccess(caller, rawSessionId, 'id, user_id, idea_prompt, patent_type, technical_analysis, data_source');
    const session_id: string = session.id;
    const supabaseClient = caller.admin;

    console.log('[EXAMINER PREDICTION] Analyzing likely patent examiner...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new HttpError(500, 'AI service is not configured.');
    }

    // Step 1: Determine CPC classification codes
    const classificationPrompt = `Determine the USPTO Cooperative Patent Classification (CPC) codes for this invention:

INVENTION: ${String(session.idea_prompt || '').slice(0, 15000)}
TECHNICAL ANALYSIS: ${String(session.technical_analysis || 'Not available').slice(0, 10000)}

Provide the most relevant CPC codes (main group and subgroup).
Focus on software/computer-implemented inventions if applicable.

Common software CPC codes:
- G06F (Electric digital data processing)
- G06Q (Data processing systems for business purposes)
- H04L (Transmission of digital information)
- G06N (Computer systems based on specific computational models)

Provide:
1. Primary CPC code (e.g., G06F 16/00)
2. Secondary CPC codes (2-3 additional)
3. Art unit (e.g., 2100 - Computer Architecture)
4. Brief explanation of why these codes apply`;

    const classification = await ask(
      LOVABLE_API_KEY,
      'You are a USPTO patent classification expert. Accurately assign CPC codes based on invention descriptions.',
      classificationPrompt,
      0.1,
      1000,
    );

    // Step 2: Predict examiner characteristics based on art unit
    const examinerPrompt = `Based on this USPTO classification analysis, predict the likely patent examiner characteristics:

CLASSIFICATION:
${classification}

Provide a realistic prediction of:
1. Art Unit - Which technology center and art unit (e.g., TC 2100)
2. Examiner Profile - Typical examiner background in this art unit
3. Average First Office Action Time - Estimated months
4. Allowance Rate - Typical allowance percentage for this art unit
5. Common Rejection Reasons - Top 3 rejection types (e.g., 102, 103, 112)
6. Examiner Preferences - What examiners in this unit look for
7. Strategy Tips - How to increase allowance chances

Base predictions on USPTO statistics for software/computer art units.
Art Units 2100-2400 handle computer-implemented inventions.
Typical allowance rates: 50-70%
Typical first action: 15-20 months

Provide practical, data-driven insights.`;

    const prediction = await ask(
      LOVABLE_API_KEY,
      'You are a USPTO prosecution expert. Provide realistic predictions based on historical patent examination data.',
      examinerPrompt,
      0.3,
      1500,
    );

    // Store prediction
    const { error: saveErr } = await supabaseClient
      .from('patent_sessions')
      .update({
        data_source: {
          ...(session.data_source && typeof session.data_source === 'object' ? session.data_source : {}),
          examiner_prediction: {
            classification,
            prediction,
            generated_at: new Date().toISOString()
          }
        }
      })
      .eq('id', session_id);
    if (saveErr) console.warn('[EXAMINER PREDICTION] Failed to store prediction:', saveErr.message);

    console.log('[EXAMINER PREDICTION] Complete');

    return jsonResponse({
      success: true,
      classification,
      prediction,
      data_source: 'AI analysis of USPTO art unit patterns (estimate, not official USPTO data)'
    });

  } catch (error) {
    return errorResponse(error, 'Examiner prediction failed', 'predict-examiner');
  }
});