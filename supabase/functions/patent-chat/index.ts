import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, sessionId, mode } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    // Fetch patent context if sessionId provided
    let patentContext = '';
    if (sessionId) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: session } = await supabaseClient
        .from('patent_sessions')
        .select('idea_prompt, patent_type, technical_analysis, patentability_score')
        .eq('id', sessionId)
        .single();

      const { data: sections } = await supabaseClient
        .from('patent_sections')
        .select('section_type, content')
        .eq('session_id', sessionId);

      const { data: priorArt } = await supabaseClient
        .from('prior_art_results')
        .select('title, publication_number, similarity_score, overlap_claims, difference_claims')
        .eq('session_id', sessionId)
        .order('similarity_score', { ascending: false })
        .limit(5);

      if (session) {
        patentContext = `
PATENT APPLICATION CONTEXT:
- Invention: ${session.idea_prompt || 'Not specified'}
- Type: ${session.patent_type || 'Not specified'}
- Patentability Score: ${session.patentability_score ? (session.patentability_score * 100).toFixed(0) + '%' : 'Not assessed'}
- Technical Analysis: ${session.technical_analysis || 'None'}

CURRENT DRAFT SECTIONS:
${(sections || []).map(s => `[${s.section_type}]: ${(s.content || '').substring(0, 500)}...`).join('\n\n')}

TOP PRIOR ART (potential conflicts):
${(priorArt || []).map(p => `- ${p.title} (${p.publication_number}) - ${((p.similarity_score || 0) * 100).toFixed(0)}% similar
  Overlaps: ${(p.overlap_claims || []).join('; ')}
  Differences: ${(p.difference_claims || []).join('; ')}`).join('\n')}
`;
      }
    }

    // Build system prompt based on mode
    let systemPrompt = '';
    switch (mode) {
      case 'claims':
        systemPrompt = `You are an elite patent attorney AI specializing in claim drafting and prosecution strategy. You have deep expertise in:
- Drafting independent and dependent claims with proper antecedent basis
- Claim interpretation under 35 U.S.C. §112
- Means-plus-function analysis
- Claim differentiation doctrine
- Prosecution history estoppel

When asked to analyze or improve claims:
1. Identify breadth vs. specificity tradeoffs
2. Check for proper antecedent basis ("a" → "the")
3. Suggest alternative claim structures (Jepson, Markush, product-by-process)
4. Evaluate enforceability and potential design-arounds
5. Recommend dependent claims to create fallback positions

${patentContext}

Always provide specific, actionable language. When suggesting rewrites, provide the exact claim language.`;
        break;
      
      case 'examiner':
        systemPrompt = `You are an AI patent prosecution expert who simulates USPTO examiner responses. You:
- Anticipate likely Office Action rejections (§101, §102, §103, §112)
- Predict examiner's prior art search strategy
- Suggest preemptive amendments to strengthen the application
- Draft response strategies to common rejections
- Evaluate Alice/Mayo eligibility for software patents

${patentContext}

When analyzing, specify which claims are most vulnerable and why. Provide concrete amendment language.`;
        break;

      case 'prior-art':
        systemPrompt = `You are an AI prior art analysis expert. You help inventors:
- Understand how their invention differs from cited prior art
- Identify novel elements not found in prior art
- Suggest claim amendments to overcome prior art
- Evaluate whether combinations of references would be obvious under §103
- Draft declaration evidence to support non-obviousness

${patentContext}

Focus on actionable differentiation strategies. Quote specific elements from the prior art and explain gaps.`;
        break;

      default:
        systemPrompt = `You are PatentBot AI, an expert patent attorney assistant. You help inventors with:
- Patent claim drafting and refinement
- Prior art analysis and differentiation
- USPTO compliance and prosecution strategy
- Patent portfolio strategy
- Responding to Office Actions
- Evaluating patentability under §101, §102, §103, §112

${patentContext}

Be specific, cite relevant patent law, and provide actionable advice. When suggesting changes, provide exact language. Keep responses focused and professional.`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
        max_tokens: 4000,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (e) {
    console.error('patent-chat error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
