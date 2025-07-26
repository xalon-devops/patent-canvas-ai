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
    
    // XALON AI endpoint configuration
    const xalonApiUrl = 'https://llm.xalon.ai/v1/chat/completions';
    const xalonApiKey = 'PatentBotAI';

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

    console.log('Starting multi-model AI drafting chain');
    
    // Helper function to call XALON AI with different models
    async function callXalonAI(model: string, systemPrompt: string, userContent: string) {
      const response = await fetch(xalonApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xalonApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`XALON AI API error for ${model}: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    }

    // Stage 1: Deep Technical Extraction using Mixtral 8x7B
    console.log('Stage 1: Deep Technical Extraction with Mixtral 8x7B');
    const technicalExtractionPrompt = `You are a technical patent expert. Extract and identify all technical details, mechanisms, components, and innovative aspects from the invention.

Focus on:
- Technical components and their relationships
- Novel mechanisms and processes
- Key innovations and differentiators
- Technical specifications and requirements
- Implementation details

Return a structured technical analysis in JSON format with these keys:
- "technical_components": array of components
- "mechanisms": array of processes/mechanisms
- "innovations": array of novel aspects
- "specifications": technical requirements`;

    const technicalAnalysis = await callXalonAI('mixtral-8x7b', technicalExtractionPrompt, 
      `Invention Idea: ${idea_prompt}\n\nQ&A Results:\n${qa_text}`);

    // Stage 2: Legal Language Formatting using Phi-3
    console.log('Stage 2: Legal Language Formatting with Phi-3');
    const legalFormattingPrompt = `You are a patent attorney specializing in legal language formatting. Convert technical content into proper patent legal language.

Transform the technical analysis into formal patent sections:
- Use precise legal terminology
- Follow USPTO formatting guidelines
- Create clear, defensible language
- Ensure proper claim structure

Return JSON with keys: "field", "background", "summary", "description"`;

    const legalFormatted = await callXalonAI('phi-3', legalFormattingPrompt, technicalAnalysis);

    // Stage 3: Claims Expansion using Mixtral again
    console.log('Stage 3: Claims Expansion with Mixtral 8x7B');
    const claimsExpansionPrompt = `You are a claims expert. Generate comprehensive patent claims based on the technical analysis and legal formatting.

Create:
- Independent claims covering core inventions
- Dependent claims for variations and embodiments
- Method claims and system claims where applicable
- Proper claim numbering and dependencies

Return JSON with key "claims" containing the complete claims section.`;

    const expandedClaims = await callXalonAI('mixtral-8x7b', claimsExpansionPrompt, 
      `Technical Analysis: ${technicalAnalysis}\n\nLegal Formatted: ${legalFormatted}`);

    // Stage 4: Prior Art Differentiation using Mixtral 8x7B
    console.log('Stage 4: Prior Art Differentiation with Mixtral 8x7B');
    const priorArtPrompt = `You are a prior art analyst. Create an abstract and ensure all content clearly differentiates from existing solutions.

Generate:
- A compelling abstract highlighting novelty
- Clear differentiation language
- Emphasis on unique advantages
- Technical drawing descriptions

Return JSON with keys: "abstract", "drawings"`;

    const priorArtDifferentiated = await callXalonAI('mixtral-8x7b', priorArtPrompt,
      `Technical: ${technicalAnalysis}\nLegal: ${legalFormatted}\nClaims: ${expandedClaims}`);

    console.log('Multi-model chain completed, assembling final draft');

    // Combine all results into final draft
    let draft;
    try {
      const technical = JSON.parse(technicalAnalysis);
      const legal = JSON.parse(legalFormatted);
      const claims = JSON.parse(expandedClaims);
      const priorArt = JSON.parse(priorArtDifferentiated);

      draft = {
        abstract: priorArt.abstract || 'Abstract not generated',
        field: legal.field || 'Field not generated',
        background: legal.background || 'Background not generated',
        summary: legal.summary || 'Summary not generated', 
        claims: claims.claims || 'Claims not generated',
        drawings: priorArt.drawings || 'Drawings description not generated',
        description: legal.description || 'Description not generated'
      };
    } catch (parseError) {
      console.error('Failed to parse AI chain responses:', parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI chain results' }), 
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