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
    
    Top 10 Most Similar Patents (DETAILED CLAIM ANALYSIS):
    ${priorArt.slice(0, 10).map((p, idx) => `
    ${idx + 1}. ${p.title}
       Publication: ${p.publication_number}
       Similarity: ${(p.similarity_score * 100).toFixed(1)}%
       Assignee: ${p.assignee || 'Unknown'}
       Date: ${p.patent_date || 'Unknown'}
       
       OVERLAPPING CLAIMS (What this patent shares with the invention):
       ${p.overlap_claims && p.overlap_claims.length > 0 
         ? p.overlap_claims.map((claim, i) => `       ${i + 1}. ${claim}`).join('\n')
         : '       None identified'}
       
       DIFFERENTIATING CLAIMS (What makes the invention unique):
       ${p.difference_claims && p.difference_claims.length > 0
         ? p.difference_claims.map((claim, i) => `       ${i + 1}. ${claim}`).join('\n')
         : '       None identified'}
       
       Summary: ${p.summary || 'No summary available'}
    `).join('\n\n')}
    `;

    const systemPrompt = `You are a patent attorney AI. Analyze this invention for patentability.

SCORING RULES:
- If prior art >80% similarity exists: Novelty score MUST be <70
- If prior art 60-80% similarity exists: Novelty score 70-80
- Be realistic and evidence-based

Return ONLY valid JSON (no markdown):
{
  "overall_score": 75,
  "criteria": [
    {"name": "Novelty", "score": 75, "maxScore": 100, "description": "How new is the invention?", "analysis": "Brief analysis of overlaps vs differences with cited prior art.", "icon": "Lightbulb"},
    {"name": "Non-obviousness", "score": 70, "maxScore": 100, "description": "Is it obvious to experts?", "analysis": "Brief analysis of whether unique features are obvious combinations.", "icon": "Target"},
    {"name": "Utility", "score": 90, "maxScore": 100, "description": "Does it have useful purpose?", "analysis": "Brief analysis of practical applications.", "icon": "Zap"},
    {"name": "Patent Eligibility", "score": 80, "maxScore": 100, "description": "Is it patentable subject matter?", "analysis": "Brief analysis under Alice/Mayo for software.", "icon": "Award"}
  ],
  "summary": "2-3 sentence summary of patentability prospects.",
  "recommendation": "proceed|refine|reconsider",
  "key_strengths": ["strength1", "strength2"],
  "areas_for_improvement": ["area1", "area2"],
  "risk_factors": ["risk1", "risk2"]
}

Keep each analysis field under 150 words. Be concise.`;

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
        max_tokens: 4000,
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