import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { session_id }: RequestBody = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing patentability for session:', session_id);

    // Get session data, questions/answers, and prior art
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

    // Compile all information for analysis
    const inventionContext = `
    Invention: ${session.idea_prompt}
    Patent Type: ${session.patent_type}
    Technical Analysis: ${session.technical_analysis || 'None provided'}
    
    AI Questions and Answers:
    ${questions.map(q => `Q: ${q.question}\nA: ${q.answer || 'Not answered'}`).join('\n\n')}
    
    Prior Art Found: ${priorArt.length} patents
    ${priorArt.slice(0, 5).map(p => `- ${p.title} (Similarity: ${(p.similarity_score * 100).toFixed(1)}%)`).join('\n')}
    `;

    const systemPrompt = `You are an expert patent attorney AI that performs comprehensive patentability assessments based on USPTO criteria.

Analyze the invention against these four key criteria:

1. NOVELTY (35 U.S.C. § 102): Is this invention new? Does prior art disclose all elements?
2. NON-OBVIOUSNESS (35 U.S.C. § 103): Would this be obvious to a person of ordinary skill?
3. UTILITY (35 U.S.C. § 101): Does this have a useful purpose and practical application?
4. PATENT ELIGIBILITY (35 U.S.C. § 101): Is this statutory subject matter (not abstract idea, law of nature, etc.)?

Return a JSON object with this exact structure:
{
  "overall_score": 85,
  "criteria": [
    {
      "name": "Novelty",
      "score": 85,
      "maxScore": 100,
      "description": "How new and original is your invention?",
      "analysis": "Detailed analysis of novelty based on prior art...",
      "icon": "Lightbulb"
    },
    {
      "name": "Non-obviousness", 
      "score": 78,
      "maxScore": 100,
      "description": "Would the invention be obvious to someone skilled in the field?",
      "analysis": "Analysis of obviousness considering prior art combinations...",
      "icon": "Target"
    },
    {
      "name": "Utility",
      "score": 95,
      "maxScore": 100,
      "description": "Does your invention have a useful purpose?",
      "analysis": "Analysis of practical utility and real-world applications...",
      "icon": "Zap"
    },
    {
      "name": "Patent Eligibility",
      "score": 88,
      "maxScore": 100,
      "description": "Is this statutory subject matter?",
      "analysis": "Analysis of subject matter eligibility under 35 U.S.C. § 101...",
      "icon": "Award"
    }
  ],
  "summary": "Comprehensive summary with recommendations...",
  "recommendation": "proceed" or "refine" or "reconsider",
  "key_strengths": ["strength 1", "strength 2"],
  "areas_for_improvement": ["improvement 1", "improvement 2"],
  "risk_factors": ["risk 1", "risk 2"]
}

Provide realistic scores based on the actual invention details and prior art similarity scores.`;

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: inventionContext }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const analysisResult = JSON.parse(aiResponse.choices[0].message.content);

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