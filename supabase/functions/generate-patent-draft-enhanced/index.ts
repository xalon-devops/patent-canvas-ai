import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

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
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from('patent_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !sessionData) {
      console.error('[ENHANCED DRAFT] Session fetch error:', sessionError);
      throw new Error(`Session not found: ${sessionError?.message || 'Unknown error'}`);
    }

    console.log('[ENHANCED DRAFT] Session found, fetching AI questions');

    // Fetch AI questions separately
    const { data: aiQuestions, error: questionsError } = await supabaseClient
      .from('ai_questions')
      .select('*')
      .eq('session_id', session_id);

    if (questionsError) {
      console.error('[ENHANCED DRAFT] Questions fetch error:', questionsError);
    }

    // Build context
    let context = `INVENTION IDEA: ${sessionData.idea_prompt || 'Not provided'}\n\n`;
    context += 'Q&A DETAILS:\n';
    aiQuestions?.forEach((q: any) => {
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

    // Generate all sections in parallel for speed
    const sectionPromises = sectionTypes.map(async (sectionType) => {
      console.log(`[ENHANCED DRAFT] Generating ${sectionType}...`);

      // Single high-quality generation with detailed prompt
      const prompt = getSectionPrompt(sectionType, context);
      const content = await callLovableAI(prompt, sectionType);
      
      // Calculate quality score
      const qualityScore = calculateQualityScore(content, sectionType);

      // Store iteration for transparency
      await supabaseClient.from('draft_iterations').insert({
        session_id,
        iteration_number: 1,
        section_type: sectionType,
        content: content,
        quality_score: qualityScore
      });

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
            content: content,
            is_user_edited: false
          })
          .eq('id', existingSection.id);
      } else {
        await supabaseClient
          .from('patent_sections')
          .insert({
            session_id,
            section_type: sectionType,
            content: content,
            is_user_edited: false
          });
      }

      return sectionType;
    });

    // Wait for all sections to complete
    const completed = await Promise.all(sectionPromises);
    sectionsGenerated = completed.length;

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

    console.log(`[ENHANCED DRAFT] Complete: ${sectionsGenerated} sections generated with parallel AI processing`);

    return new Response(JSON.stringify({
      success: true,
      sections_generated: sectionsGenerated,
      processing_mode: 'parallel',
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

async function callLovableAI(prompt: string, sectionType: string): Promise<string> {
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  console.log(`[Lovable AI] Generating ${sectionType}...`);

  // Use gemini-2.5-pro for all sections to ensure high quality single-pass generation
  const model = 'google/gemini-2.5-pro';
  const maxTokens = sectionType === 'description' ? 10000 : 
                    sectionType === 'claims' ? 8000 : 4000;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: 'You are an expert USPTO patent attorney. Generate high-quality, legally compliant patent sections that meet all USPTO requirements.'
        },
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