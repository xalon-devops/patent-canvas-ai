import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, section_type } = await req.json();
    
    if (!session_id || !section_type) {
      return new Response(
        JSON.stringify({ error: 'session_id and section_type are required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch session data and existing sections
    const { data: session } = await supabase
      .from('patent_sessions')
      .select('idea_prompt')
      .eq('id', session_id)
      .single();

    const { data: questions } = await supabase
      .from('ai_questions')
      .select('question, answer')
      .eq('session_id', session_id)
      .not('answer', 'is', null);

    // Get enhanced prompts for different section types
    const sectionPrompts = {
      abstract: `Create a comprehensive USPTO-compliant abstract (150 words max) that:
- Summarizes the invention's technical field, problem solved, and solution
- Uses precise technical language and terminology
- Follows USPTO MPEP guidelines for abstracts
- Includes specific technical details and benefits`,
      
      claims: `Generate independent and dependent patent claims that:
- Use precise legal claim language following USPTO standards
- Include at least 1 independent claim and 3-5 dependent claims
- Cover the broadest reasonable scope of protection
- Use proper claim formatting and numbering
- Include specific technical limitations and elements`,
      
      background: `Write a detailed background section that:
- Describes the technical field and existing solutions
- Identifies specific problems and limitations in prior art
- Establishes the need for the invention
- Cites relevant technical standards and practices
- Uses formal patent application language`,
      
      description: `Create a comprehensive detailed description that:
- Provides complete technical implementation details
- Includes references to drawings and figures
- Explains all technical components and their interactions
- Covers multiple embodiments and variations
- Uses precise engineering terminology and specifications`,
      
      summary: `Write an invention summary that:
- Clearly states the objects and advantages of the invention
- Describes the technical solution and key innovations
- Explains how the invention solves identified problems
- Highlights unique features and technical benefits
- Follows USPTO summary requirements`
    };

    const sectionPrompt = sectionPrompts[section_type as keyof typeof sectionPrompts] || 
                         `Create a detailed ${section_type} section for this patent application.`;

    // Build context from Q&A
    const qaContext = questions?.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n') || '';

    const fullPrompt = `${sectionPrompt}

Invention Idea: ${session.idea_prompt}

Additional Context from Q&A:
${qaContext}

Requirements:
- Use professional patent application language
- Be technically precise and comprehensive
- Follow USPTO formatting guidelines
- Include specific details and technical specifications
- Ensure novelty and non-obviousness are clear`;

    // Call OpenAI with enhanced model selection
    const model = section_type === 'claims' ? 'gpt-4.1-2025-04-14' : 'gpt-5-mini-2025-08-07';
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a patent attorney expert in drafting USPTO patent applications. Provide professional, technically accurate content that meets patent office standards.'
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        max_completion_tokens: section_type === 'description' ? 2000 : 1000,
      }),
    });

    const openaiData = await openaiResponse.json();
    const enhancedContent = openaiData.choices[0]?.message?.content;

    if (!enhancedContent) {
      throw new Error('Failed to generate enhanced content');
    }

    // Update or create the section
    const { error: upsertError } = await supabase
      .from('patent_sections')
      .upsert({
        session_id,
        section_type,
        content: enhancedContent,
        is_user_edited: false
      }, {
        onConflict: 'session_id,section_type'
      });

    if (upsertError) {
      throw upsertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        section_type,
        model_used: model,
        content_length: enhancedContent.length
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error enhancing patent section:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to enhance patent section' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});