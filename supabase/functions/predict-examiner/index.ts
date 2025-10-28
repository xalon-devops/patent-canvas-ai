import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[EXAMINER PREDICTION] Analyzing likely patent examiner...');

    // Fetch patent session
    const { data: session } = await supabaseClient
      .from('patent_sessions')
      .select('idea_prompt, patent_type, technical_analysis')
      .eq('id', session_id)
      .single();

    if (!session) {
      throw new Error('Session not found');
    }

    // Determine technology area and CPC codes
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Step 1: Determine CPC classification codes
    const classificationPrompt = `Determine the USPTO Cooperative Patent Classification (CPC) codes for this invention:

INVENTION: ${session.idea_prompt}
TECHNICAL ANALYSIS: ${session.technical_analysis || 'Not available'}

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

    const classResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'You are a USPTO patent classification expert. Accurately assign CPC codes based on invention descriptions.'
          },
          { role: 'user', content: classificationPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    const classData = await classResponse.json();
    const classification = classData.choices[0].message.content;

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

    const examinerResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'You are a USPTO prosecution expert. Provide realistic predictions based on historical patent examination data.'
          },
          { role: 'user', content: examinerPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      }),
    });

    const examinerData = await examinerResponse.json();
    const prediction = examinerData.choices[0].message.content;

    // Store prediction
    await supabaseClient
      .from('patent_sessions')
      .update({
        data_source: {
          ...session.data_source,
          examiner_prediction: {
            classification,
            prediction,
            generated_at: new Date().toISOString()
          }
        }
      })
      .eq('id', session_id);

    console.log('[EXAMINER PREDICTION] Complete');

    return new Response(JSON.stringify({
      success: true,
      classification,
      prediction,
      data_source: 'Lovable AI analysis of USPTO art unit patterns'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[EXAMINER PREDICTION] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});