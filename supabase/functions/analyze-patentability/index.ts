import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  session_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const { session_id }: RequestBody = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing patentability for session:', session_id);

    // Get session data, questions/answers, prior art, and backend analysis
    const [sessionResult, questionsResult, priorArtResult] = await Promise.all([
      supabaseClient
        .from('patent_sessions')
        .select('*')
        .eq('id', session_id)
        .single(),
      supabaseClient
        .from('ai_questions')
        .select('*')
        .eq('session_id', session_id),
      supabaseClient
        .from('prior_art_results')
        .select('*')
        .eq('session_id', session_id)
        .order('similarity_score', { ascending: false })
    ]);

    if (sessionResult.error) throw sessionResult.error;
    
    const session = sessionResult.data;
    const questions = questionsResult.data || [];
    const priorArt = priorArtResult.data || [];

    // Extract backend data from session
    const backendAnalysis = session.data_source?.supabase_backend || null;
    const backendSummary = backendAnalysis?.ai_summary || '';
    const backendStats = backendAnalysis?.statistics || {};
    
    // Count high-risk prior art
    const highRiskPriorArt = priorArt.filter(p => p.similarity_score >= 0.8);
    const mediumRiskPriorArt = priorArt.filter(p => p.similarity_score >= 0.6 && p.similarity_score < 0.8);

    // Compile all information for analysis
    const inventionContext = `
    Invention: ${session.idea_prompt}
    Patent Type: ${session.patent_type}
    Technical Analysis: ${session.technical_analysis || 'None provided'}
    
    ${backendAnalysis ? `
    SUPABASE BACKEND ANALYSIS:
    - Tables: ${backendStats.tables_found || 0}
    - Functions: ${backendStats.functions_found || 0}
    - Storage Buckets: ${backendStats.storage_buckets_found || 0}
    - RLS Policies: ${backendStats.rls_policies_found || 0}
    
    Backend Summary:
    ${backendSummary}
    ` : ''}
    
    AI Questions and Answers:
    ${questions.map(q => `Q: ${q.question}\nA: ${q.answer || 'Not answered'}`).join('\n\n')}
    
    PRIOR ART ANALYSIS:
    Total Patents Found: ${priorArt.length}
    High Risk (>80% similar): ${highRiskPriorArt.length}
    Medium Risk (60-80% similar): ${mediumRiskPriorArt.length}
    
    Top 5 Most Similar Patents:
    ${priorArt.slice(0, 5).map(p => `
    - ${p.title}
      Publication: ${p.publication_number}
      Similarity: ${(p.similarity_score * 100).toFixed(1)}%
      Overlaps: ${p.overlap_claims?.slice(0, 2).join(', ') || 'None'}
      Differences: ${p.difference_claims?.slice(0, 2).join(', ') || 'None'}
    `).join('\n')}
    `;

    const systemPrompt = `You are an expert patent attorney AI that performs comprehensive patentability assessments based on USPTO criteria.

Analyze the invention against these four key criteria, considering ALL provided context including backend analysis, prior art, and Q&A:

1. NOVELTY (35 U.S.C. § 102): Is this invention new? Consider prior art similarity scores - high scores (>80%) significantly reduce novelty.
2. NON-OBVIOUSNESS (35 U.S.C. § 103): Would this be obvious to a person of ordinary skill? Consider combinations of prior art elements.
3. UTILITY (35 U.S.C. § 101): Does this have a useful purpose? Consider the technical implementation details from backend analysis.
4. PATENT ELIGIBILITY (35 U.S.C. § 101): Is this statutory subject matter? Software must show technical improvements, not just abstract ideas.

CRITICAL SCORING GUIDELINES:
- If high-risk prior art exists (>80% similarity), Novelty score MUST be below 70
- If backend analysis shows basic CRUD operations only, scores should reflect limited innovation
- Software patents need demonstrated technical improvements over existing systems
- Consider overlapping claims from prior art in your analysis

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "overall_score": 85,
  "criteria": [
    {
      "name": "Novelty",
      "score": 85,
      "maxScore": 100,
      "description": "How new and original is your invention?",
      "analysis": "Detailed analysis referencing specific prior art if applicable...",
      "icon": "Lightbulb"
    },
    {
      "name": "Non-obviousness", 
      "score": 78,
      "maxScore": 100,
      "description": "Would the invention be obvious to someone skilled in the field?",
      "analysis": "Analysis considering prior art combinations and technical advancements...",
      "icon": "Target"
    },
    {
      "name": "Utility",
      "score": 95,
      "maxScore": 100,
      "description": "Does your invention have a useful purpose?",
      "analysis": "Analysis of practical utility based on backend implementation and use cases...",
      "icon": "Zap"
    },
    {
      "name": "Patent Eligibility",
      "score": 88,
      "maxScore": 100,
      "description": "Is this statutory subject matter?",
      "analysis": "Analysis under Alice/Mayo framework for software, technical improvements emphasized...",
      "icon": "Award"
    }
  ],
  "summary": "Comprehensive summary with specific references to backend features and prior art risks...",
  "recommendation": "proceed",
  "key_strengths": ["Specific technical feature 1", "Backend capability 2"],
  "areas_for_improvement": ["Differentiate from Patent X", "Emphasize technical improvement Y"],
  "risk_factors": ["Prior art similarity with Patent A", "Abstract idea concerns if software"]
}

Be REALISTIC - don't give high scores without justification from the provided data.`;

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('Lovable AI API key not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: inventionContext }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('AI credits depleted. Please add credits to continue.');
      }
      
      throw new Error(`Lovable AI API error: ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const rawContent = aiResponse.choices[0].message.content;
    
    console.log('Raw AI response:', rawContent);
    
    // Parse JSON, handling potential markdown wrapping
    let analysisResult;
    try {
      analysisResult = JSON.parse(rawContent);
    } catch (e) {
      // Try extracting JSON from markdown code block
      const jsonMatch = rawContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    // Update session with patentability score
    await supabaseClient
      .from('patent_sessions')
      .update({ 
        patentability_score: analysisResult.overall_score / 100,
        ai_analysis_complete: true 
      })
      .eq('id', session_id);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysisResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-patentability:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});