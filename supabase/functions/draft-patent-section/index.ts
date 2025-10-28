import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  session_id: string;
  section_type: string;
  user_input?: string;
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

    const { session_id, section_type, user_input }: RequestBody = await req.json();

    console.log(`Drafting ${section_type} section for session:`, session_id);

    // Get session data and all answered questions
    const [sessionResult, questionsResult, existingSectionsResult] = await Promise.all([
      supabaseClient
        .from('patent_sessions')
        .select('*')
        .eq('id', session_id)
        .single(),
      supabaseClient
        .from('ai_questions')
        .select('*')
        .eq('session_id', session_id)
        .not('answer', 'is', null),
      supabaseClient
        .from('patent_sections')
        .select('*')
        .eq('session_id', session_id)
    ]);

    if (sessionResult.error) throw sessionResult.error;

    const session = sessionResult.data;
    const questions = questionsResult.data || [];
    const existingSections = existingSectionsResult.data || [];

    // Build comprehensive context
    const inventionContext = `
    Invention Title: ${session.idea_prompt}
    Patent Type: ${session.patent_type}
    Technical Analysis: ${session.technical_analysis || ''}
    
    Detailed Q&A:
    ${questions.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n')}
    
    Existing Sections:
    ${existingSections.map(s => `${s.section_type}:\n${s.content}`).join('\n\n')}
    
    ${user_input ? `Additional Input: ${user_input}` : ''}
    `;

    // Section-specific prompts
    const sectionPrompts = {
      'abstract': `Write a concise patent abstract (150 words max) that summarizes the invention's purpose, key features, and advantages. Follow USPTO guidelines for abstract writing.`,
      
      'background': `Write the Background of the Invention section. Include:
      - Field of the invention
      - Description of related art and its limitations
      - Problems solved by this invention
      Use formal patent language and cite relevant prior art if known.`,
      
      'summary': `Write the Summary of the Invention section. Provide:
      - Brief summary of the invention's key aspects
      - Primary advantages and benefits
      - How it solves the stated problems
      Keep it concise but comprehensive.`,
      
      'detailed_description': `Write the Detailed Description section. Include:
      - Comprehensive technical description
      - How the invention works
      - Implementation details
      - Specific examples and embodiments
      Use clear, precise technical language.`,
      
      'claims': `Draft the patent claims. Start with:
      - One independent claim covering the broadest scope
      - 2-3 dependent claims adding specific features
      Use proper claim language and numbering.
      Follow USPTO claim drafting guidelines.`,
      
      'drawings': `Describe the patent drawings/figures needed:
      - List each figure and what it shows
      - Brief description of key elements
      - How figures relate to the invention
      Format as drawing descriptions for a patent application.`
    };

    const systemPrompt = `You are an expert patent attorney AI specialized in drafting high-quality patent applications. 

Section to draft: ${section_type.toUpperCase()}

${sectionPrompts[section_type as keyof typeof sectionPrompts] || 'Draft the requested section with appropriate patent language and formatting.'}

Write professional, precise patent language that would be suitable for USPTO filing. Be technically accurate and legally compliant.

Return only the section content, formatted appropriately for a patent application.`;

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
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const sectionContent = aiResponse.choices[0].message.content;

    // Check if section already exists
    const existingSection = existingSections.find(s => s.section_type === section_type);

    if (existingSection) {
      // Update existing section
      await supabaseClient
        .from('patent_sections')
        .update({ 
          content: sectionContent,
          is_user_edited: false 
        })
        .eq('id', existingSection.id);
    } else {
      // Create new section
      await supabaseClient
        .from('patent_sections')
        .insert({
          session_id,
          section_type,
          content: sectionContent,
          is_user_edited: false
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        section_type,
        content: sectionContent,
        word_count: sectionContent.split(/\s+/).length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in draft-patent-section:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});