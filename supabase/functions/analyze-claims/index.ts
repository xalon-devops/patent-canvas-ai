import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  fetchWithTimeout, aiGatewayError, parseModelJson,
} from '../_shared/http.ts';

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // Signed-in user (or service role) required — the anon key alone is not accepted
    await authenticate(req);

    const body = await readJson<{ claims?: unknown; priorArt?: unknown; inventionContext?: unknown }>(req, 500_000);
    const claims = typeof body.claims === 'string' ? body.claims.slice(0, 60_000) : '';
    const priorArt = Array.isArray(body.priorArt) ? body.priorArt.slice(0, 10) : [];
    const inventionContext = typeof body.inventionContext === 'string' ? body.inventionContext.slice(0, 20_000) : '';

    if (!claims.trim()) {
      throw new HttpError(400, 'Claims content is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new HttpError(500, 'AI service is not configured.');

    const priorArtContext = priorArt?.length > 0
      ? `\n\nRELEVANT PRIOR ART:\n${priorArt.map((p: any, i: number) => 
          `${i+1}. ${p.title} (${p.publication_number}) - ${((p.similarity_score || 0) * 100).toFixed(0)}% similar\n   Overlaps: ${(p.overlap_claims || []).join('; ')}\n   Differences: ${(p.difference_claims || []).join('; ')}`
        ).join('\n')}`
      : '';

    const response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are an elite patent claim analyst with 20+ years of USPTO prosecution experience. Analyze patent claims with the rigor of a senior patent examiner combined with the strategic thinking of a top patent litigator.`
          },
          {
            role: 'user',
            content: `Analyze these patent claims for strength, enforceability, and USPTO compliance.

INVENTION CONTEXT: ${inventionContext || 'Not provided'}
${priorArtContext}

CLAIMS TO ANALYZE:
${claims}

For EACH claim, provide analysis as a JSON object:
{
  "overallScore": <0-100>,
  "overallGrade": "<A/B/C/D/F>",
  "claims": [
    {
      "claimNumber": <number>,
      "claimText": "<the claim text>",
      "type": "independent|dependent",
      "scores": {
        "breadth": <0-100, higher = broader scope>,
        "specificity": <0-100, higher = more precise language>,
        "enforceability": <0-100, how easy to detect infringement>,
        "novelty": <0-100, distinctiveness from prior art>,
        "clarity": <0-100, §112 compliance>
      },
      "vulnerabilities": [
        {"type": "§101|§102|§103|§112", "risk": "high|medium|low", "explanation": "<specific issue>"}
      ],
      "suggestedRewrite": "<improved claim language if score < 80>",
      "strategicNotes": "<prosecution strategy advice>"
    }
  ],
  "portfolioRecommendations": [
    "<strategic recommendation for additional claims or continuation strategy>"
  ],
  "examinerPrediction": {
    "likelyRejections": ["<predicted Office Action issues>"],
    "suggestedPreemptiveAmendments": ["<amendments to file proactively>"]
  }
}

Be extremely specific. Reference exact claim language when identifying issues. Provide concrete rewrite suggestions.`
          }
        ],
        temperature: 0.3,
        max_tokens: 6000,
      }),
    }, 90_000);

    if (!response.ok) throw await aiGatewayError(response, 'analyze-claims');

    const aiData = await response.json().catch(() => null);
    const aiContent = aiData?.choices?.[0]?.message?.content;
    if (!aiContent) throw new HttpError(502, 'No analysis generated. Please try again.');

    let analysis = parseModelJson(aiContent);
    if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
      console.error('Failed to parse claim analysis:', aiContent);
      analysis = {
        overallScore: 65,
        overallGrade: 'C',
        claims: [],
        portfolioRecommendations: ['Manual review recommended - AI parsing failed'],
        examinerPrediction: { likelyRejections: [], suggestedPreemptiveAmendments: [] }
      };
    }
    if (!Array.isArray(analysis.claims)) analysis.claims = [];
    if (!Array.isArray(analysis.portfolioRecommendations)) analysis.portfolioRecommendations = [];
    if (!analysis.examinerPrediction || typeof analysis.examinerPrediction !== 'object') {
      analysis.examinerPrediction = { likelyRejections: [], suggestedPreemptiveAmendments: [] };
    }

    return jsonResponse({ success: true, analysis });

  } catch (error) {
    return errorResponse(error, 'Analysis failed', 'analyze-claims');
  }
});
