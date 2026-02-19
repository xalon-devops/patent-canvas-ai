import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { claims, priorArt, inventionContext } = await req.json();

    if (!claims) {
      return new Response(
        JSON.stringify({ error: 'Claims content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const priorArtContext = priorArt?.length > 0
      ? `\n\nRELEVANT PRIOR ART:\n${priorArt.map((p: any, i: number) => 
          `${i+1}. ${p.title} (${p.publication_number}) - ${((p.similarity_score || 0) * 100).toFixed(0)}% similar\n   Overlaps: ${(p.overlap_claims || []).join('; ')}\n   Differences: ${(p.difference_claims || []).join('; ')}`
        ).join('\n')}`
      : '';

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      throw new Error('AI analysis failed');
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    if (!aiContent) throw new Error('No analysis generated');

    let analysis;
    try {
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/) || aiContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiContent;
      analysis = JSON.parse(jsonStr.trim());
    } catch {
      console.error('Failed to parse claim analysis:', aiContent);
      analysis = {
        overallScore: 65,
        overallGrade: 'C',
        claims: [],
        portfolioRecommendations: ['Manual review recommended - AI parsing failed'],
        examinerPrediction: { likelyRejections: [], suggestedPreemptiveAmendments: [] }
      };
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing claims:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
