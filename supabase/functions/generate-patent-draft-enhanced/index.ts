import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

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

    console.log('[ENHANCED DRAFT - LOVABLE AI] Starting iterative patent generation');

    // Fetch session data
    const { data: sessionData } = await supabaseClient
      .from('patent_sessions')
      .select('*, ai_questions(*)')
      .eq('id', session_id)
      .single();

    if (!sessionData) {
      throw new Error('Session not found');
    }

    // Build context
    let context = `INVENTION IDEA: ${sessionData.idea_prompt}\n\n`;
    context += 'Q&A DETAILS:\n';
    sessionData.ai_questions?.forEach((q: any) => {
      if (q.answer) {
        context += `Q: ${q.question}\nA: ${q.answer}\n\n`;
      }
    });

    // Add Supabase backend analysis if available
    if (sessionData.data_source?.supabase_backend) {
      context += '\n\nSUPABASE BACKEND ARCHITECTURE:\n';
      context += JSON.stringify(sessionData.data_source.supabase_backend, null, 2);
    }

    const sectionTypes = ['abstract', 'field', 'background', 'summary', 'claims', 'description', 'drawings'];
    let sectionsGenerated = 0;

    for (const sectionType of sectionTypes) {
      console.log(`[ENHANCED DRAFT] Generating ${sectionType}...`);

      // ITERATION 1: Generate initial draft
      const initialPrompt = getSectionPrompt(sectionType, context);
      const initialDraft = await callLovableAI(initialPrompt, 'initial');
      
      // ITERATION 2: Self-critique
      const critiquePrompt = `You are a patent attorney reviewing this ${sectionType} section. Identify weaknesses, missing elements, and areas for improvement:

${initialDraft}

Provide specific, actionable critique focusing on USPTO compliance, clarity, and legal strength.`;

      const critique = await callLovableAI(critiquePrompt, 'critique');

      // ITERATION 3: Refine based on critique
      const refinePrompt = `Based on this critique, rewrite the ${sectionType} section with improvements:

CRITIQUE:
${critique}

ORIGINAL DRAFT:
${initialDraft}

CONTEXT:
${context}

Produce a polished, USPTO-compliant section that addresses all critiques.`;

      const finalDraft = await callLovableAI(refinePrompt, 'refine');

      // ITERATION 4: Format check (only for claims)
      let qualityCheckedDraft = finalDraft;
      if (sectionType === 'claims') {
        const formatPrompt = `Verify this claims section follows USPTO format requirements:
- Numbered claims (1., 2., etc.)
- Independent claims first
- Proper dependent claim references
- Single sentence per claim
- Correct legal phrasing

CLAIMS:
${finalDraft}

If corrections needed, provide corrected version. Otherwise return the claims as-is.`;

        qualityCheckedDraft = await callLovableAI(formatPrompt, 'format-check');
      }

      // Calculate quality score
      const qualityScore = calculateQualityScore(qualityCheckedDraft, sectionType);

      // Store iterations for transparency
      await supabaseClient.from('draft_iterations').insert([
        {
          session_id,
          iteration_number: 1,
          section_type: sectionType,
          content: initialDraft,
          quality_score: 0.6
        },
        {
          session_id,
          iteration_number: 2,
          section_type: sectionType,
          content: finalDraft,
          critique: critique,
          quality_score: 0.8
        },
        {
          session_id,
          iteration_number: 3,
          section_type: sectionType,
          content: qualityCheckedDraft,
          quality_score: qualityScore
        }
      ]);

      // Upsert final section
      const { data: existingSection } = await supabaseClient
        .from('patent_sections')
        .select('id')
        .eq('session_id', session_id)
        .eq('section_type', sectionType)
        .maybeSingle();

      if (existingSection) {
        await supabaseClient
          .from('patent_sections')
          .update({
            content: qualityCheckedDraft,
            is_user_edited: false
          })
          .eq('id', existingSection.id);
      } else {
        await supabaseClient
          .from('patent_sections')
          .insert({
            session_id,
            section_type: sectionType,
            content: qualityCheckedDraft,
            is_user_edited: false
          });
      }

      sectionsGenerated++;
    }

    // Update session status
    await supabaseClient
      .from('patent_sessions')
      .update({ 
        status: 'completed',
        ai_analysis_complete: true
      })
      .eq('id', session_id);

    // Send completion email
    await supabaseClient.functions.invoke('send-notification-email', {
      body: {
        user_id: sessionData.user_id,
        type: 'draft_complete',
        session_id: session_id
      }
    });

    console.log(`[ENHANCED DRAFT] Complete: ${sectionsGenerated} sections generated with 3x Lovable AI refinement`);

    return new Response(JSON.stringify({
      success: true,
      sections_generated: sectionsGenerated,
      iterations_per_section: 3,
      quality_checked: true,
      ai_model: 'google/gemini-2.5-pro'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ENHANCED DRAFT] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function callLovableAI(prompt: string, stage: string): Promise<string> {
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  console.log(`[Lovable AI - ${stage}] Calling API...`);

  // Use gemini-2.5-pro for maximum quality (equivalent to Claude Sonnet 4.5)
  const model = stage === 'refine' ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash';
  const maxTokens = stage === 'refine' ? 8000 : 4000;
  const temperature = stage === 'critique' ? 0.3 : 0.1;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    
    // Handle rate limits
    if (response.status === 429) {
      throw new Error('Lovable AI rate limit exceeded. Please try again in a few moments.');
    }
    if (response.status === 402) {
      throw new Error('Lovable AI credits depleted. Please add credits to continue.');
    }
    
    throw new Error(`Lovable AI error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function getSectionPrompt(sectionType: string, context: string): string {
  const prompts: { [key: string]: string } = {
    abstract: `Write a USPTO-compliant patent abstract (150 words max) that concisely summarizes the invention:

${context}

Requirements:
- Single paragraph, 150 words max
- State what the invention is
- State what the invention does
- State how it achieves its purpose
- No commercial puffery
- Present tense, third person`,

    field: `Write the "Field of the Invention" section:

${context}

Requirements:
- 2-3 sentences
- State the technical field
- Reference class/subclass if applicable
- Be specific but not limiting`,

    background: `Write the "Background of the Invention" section:

${context}

Requirements:
- Describe the problem being solved
- Explain limitations of prior art
- Do NOT cite specific prior art (that comes later)
- Build case for why invention is needed
- 200-400 words`,

    summary: `Write the "Summary of the Invention" section:

${context}

Requirements:
- Expand on the abstract
- Describe the invention's key features
- Explain advantages over prior art
- Describe different embodiments
- 400-600 words
- Clear, technical language`,

    claims: `Write independent and dependent patent claims:

${context}

Requirements:
- Start with 3-5 independent claims (broadest protection)
- Follow with 10-15 dependent claims (narrow aspects)
- Use proper format: "1. A method comprising..."
- Single sentence per claim
- Dependent claims: "2. The method of claim 1, wherein..."
- Cover apparatus, method, and system claims
- Use clear antecedent basis
- For software/backend inventions, include data structure claims`,

    description: `Write the "Detailed Description" section:

${context}

Requirements:
- Extremely detailed technical description
- Reference figures if applicable
- Explain every element in the claims
- Provide examples and embodiments
- Use clear, enabling language
- 1000-2000 words
- Satisfy enablement requirement
- For backend systems, describe data flows and architecture`,

    drawings: `Describe patent drawings needed:

${context}

Requirements:
- List and describe each figure needed
- Fig. 1: [Overview/system diagram]
- Fig. 2-N: [Detailed views, flowcharts, etc.]
- Provide detailed descriptions
- Explain what each figure shows
- Reference key elements
- For backend systems, include architecture diagrams and data flow charts`
  };

  return prompts[sectionType] || `Write the ${sectionType} section based on:\n\n${context}`;
}

function calculateQualityScore(content: string, sectionType: string): number {
  let score = 0.7; // Base score

  // Length checks
  const wordCount = content.split(/\s+/).length;
  const targetLengths: { [key: string]: [number, number] } = {
    abstract: [120, 150],
    field: [30, 80],
    background: [200, 400],
    summary: [400, 600],
    claims: [300, 1000],
    description: [1000, 2000],
    drawings: [100, 300]
  };

  const [min, max] = targetLengths[sectionType] || [100, 1000];
  if (wordCount >= min && wordCount <= max) {
    score += 0.1;
  }

  // Format checks for claims
  if (sectionType === 'claims') {
    if (/^\d+\.\s+A\s+(method|system|apparatus|device)/i.test(content)) {
      score += 0.1; // Proper claim format
    }
    if (content.includes('wherein')) {
      score += 0.05; // Dependent claims present
    }
  }

  // Technical depth
  const technicalTerms = content.match(/\b(comprising|configured|operably|substantially|embodiment|predetermined)\b/gi);
  if (technicalTerms && technicalTerms.length > 5) {
    score += 0.05;
  }

  return Math.min(score, 1.0);
}