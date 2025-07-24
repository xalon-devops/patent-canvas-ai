import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Patent draft generation started');
    
    const { session_id } = await req.json();
    
    if (!session_id) {
      console.error('Missing session_id in request');
      return new Response(
        JSON.stringify({ error: 'session_id is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      console.error('Missing OpenAI API key');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch patent session details
    console.log('Fetching patent session:', session_id);
    const { data: session, error: sessionError } = await supabase
      .from('patent_sessions')
      .select('idea_prompt, user_id')
      .eq('id', session_id)
      .single();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch AI Q&A results
    console.log('Fetching AI questions for session:', session_id);
    const { data: questions, error: qError } = await supabase
      .from('ai_questions')
      .select('question, answer')
      .eq('session_id', session_id)
      .not('answer', 'is', null);

    if (qError) {
      console.error('Error fetching questions:', qError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch questions' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!questions || questions.length === 0) {
      console.error('No answered questions found for session:', session_id);
      return new Response(
        JSON.stringify({ error: 'No answered questions found' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Format Q&A text
    const qa_text = questions.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n');
    const idea_prompt = session.idea_prompt || 'No specific idea provided';

    console.log('Calling OpenAI API for patent draft generation');
    
    // Call OpenAI API to generate structured patent draft
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are an expert patent attorney AI assistant. Generate a comprehensive utility patent application draft based on the provided invention idea and Q&A session.

IMPORTANT: Return your response as a valid JSON object with the following exact section types as keys:
- "abstract"
- "field"
- "background" 
- "summary"
- "claims"
- "drawings"
- "description"

Each section should contain well-structured, professional patent language appropriate for a utility patent application. Make sure the JSON is properly formatted and contains no syntax errors.

Original Invention Idea: ${idea_prompt}

Q&A Session Results:
${qa_text}

Generate a complete patent draft covering all sections with detailed, professional content suitable for patent filing.`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate patent draft' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices[0].message.content;

    console.log('OpenAI response received, parsing JSON');

    let draft;
    try {
      draft = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('OpenAI response:', generatedContent);
      return new Response(
        JSON.stringify({ error: 'Failed to parse generated content' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate that we have the expected sections
    const expectedSections = ['abstract', 'field', 'background', 'summary', 'claims', 'drawings', 'description'];
    const missingSections = expectedSections.filter(section => !draft[section]);
    
    if (missingSections.length > 0) {
      console.warn('Missing sections in generated draft:', missingSections);
    }

    // Prepare sections for database insertion
    const sections = Object.entries(draft)
      .filter(([_, content]) => content && typeof content === 'string')
      .map(([type, content]) => ({
        session_id,
        section_type: type,
        content: content as string,
        is_user_edited: false
      }));

    if (sections.length === 0) {
      console.error('No valid sections found in generated draft');
      return new Response(
        JSON.stringify({ error: 'No valid sections generated' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Inserting ${sections.length} sections into database`);

    // Clear existing sections for this session and insert new ones
    const { error: deleteError } = await supabase
      .from('patent_sections')
      .delete()
      .eq('session_id', session_id);

    if (deleteError) {
      console.warn('Error clearing existing sections:', deleteError);
    }

    // Insert new sections
    const { error: insertError } = await supabase
      .from('patent_sections')
      .insert(sections);

    if (insertError) {
      console.error('Error inserting sections:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save patent sections' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update session status to completed
    const { error: updateError } = await supabase
      .from('patent_sessions')
      .update({ status: 'completed' })
      .eq('id', session_id);

    if (updateError) {
      console.warn('Error updating session status:', updateError);
    }

    console.log('Patent draft generation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        sections_generated: sections.length,
        sections: sections.map(s => ({ type: s.section_type, length: s.content.length }))
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in generate-patent-draft function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});