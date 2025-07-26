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
    
    // OpenAI API configuration
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
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

    console.log('Starting multi-model AI drafting chain');
    
    // Helper function to call OpenAI
    async function callOpenAI(systemPrompt: string, userContent: string) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAIApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
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
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    }

    // Stage 1: Deep Technical Extraction using OpenAI
    console.log('Stage 1: Deep Technical Extraction with OpenAI');
    const technicalExtractionPrompt = `You are a technical patent expert. Extract and identify all technical details, mechanisms, components, and innovative aspects from the invention.

Focus on:
- Technical components and their relationships
- Novel mechanisms and processes
- Key innovations and differentiators
- Technical specifications and requirements
- Implementation details

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. The JSON must have these exact keys:
{
  "technical_components": ["component1", "component2"],
  "mechanisms": ["mechanism1", "mechanism2"],
  "innovations": ["innovation1", "innovation2"],
  "specifications": "technical requirements description"
}`;

    const technicalAnalysis = await callOpenAI(technicalExtractionPrompt, 
      `Invention Idea: ${idea_prompt}\n\nQ&A Results:\n${qa_text}`);

    // Stage 2: Legal Language Formatting using OpenAI
    console.log('Stage 2: Legal Language Formatting with OpenAI');
    const legalFormattingPrompt = `You are a patent attorney specializing in legal language formatting. Convert technical content into proper patent legal language.

Transform the technical analysis into formal patent sections:
- Use precise legal terminology
- Follow USPTO formatting guidelines
- Create clear, defensible language
- Ensure proper claim structure

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. The JSON must have these exact keys:
{
  "field": "field description text",
  "background": "background description text", 
  "summary": "summary description text",
  "description": "detailed description text"
}`;

    const legalFormatted = await callOpenAI(legalFormattingPrompt, technicalAnalysis);

    // Stage 3: Claims Expansion using OpenAI
    console.log('Stage 3: Claims Expansion with OpenAI');
    const claimsExpansionPrompt = `You are a claims expert. Generate comprehensive patent claims based on the technical analysis and legal formatting.

Create:
- Independent claims covering core inventions
- Dependent claims for variations and embodiments
- Method claims and system claims where applicable
- Proper claim numbering and dependencies

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. The JSON must have this exact structure:
{
  "claims": "1. A system for... 2. The system of claim 1, wherein..."
}`;

    const expandedClaims = await callOpenAI(claimsExpansionPrompt, 
      `Technical Analysis: ${technicalAnalysis}\n\nLegal Formatted: ${legalFormatted}`);

    // Stage 4: Prior Art Differentiation using OpenAI
    console.log('Stage 4: Prior Art Differentiation with OpenAI');
    const priorArtPrompt = `You are a prior art analyst. Create an abstract and ensure all content clearly differentiates from existing solutions.

Generate:
- A compelling abstract highlighting novelty
- Clear differentiation language
- Emphasis on unique advantages
- Technical drawing descriptions

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. The JSON must have these exact keys:
{
  "abstract": "abstract text here",
  "drawings": "technical drawing descriptions here"
}`;

    const priorArtDifferentiated = await callOpenAI(priorArtPrompt, 
      `Technical: ${technicalAnalysis}\nLegal: ${legalFormatted}\nClaims: ${expandedClaims}`);

    console.log('Multi-model chain completed, assembling final draft');

    // Combine all results into final draft - use fallback approach
    let draft;
    try {
      // Instead of relying on JSON parsing, extract meaningful content directly
      console.log('Using direct text extraction approach');
      
      // Simple text extraction function
      const extractContent = (response: string, fallback: string) => {
        if (!response || response.trim().length === 0) return fallback;
        
        // Try to extract JSON first
        try {
          const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          const parsed = JSON.parse(cleaned);
          return parsed;
        } catch {
          // If JSON fails, use the raw text as meaningful content
          return response.trim().substring(0, 1000); // Limit length
        }
      };

      const technical = extractContent(technicalAnalysis, 'Technical analysis not available');
      const legal = extractContent(legalFormatted, 'Legal formatting not available');
      const claims = extractContent(expandedClaims, 'Claims not available');
      const priorArt = extractContent(priorArtDifferentiated, 'Prior art analysis not available');

      // Build draft with extracted content
      draft = {
        abstract: (typeof priorArt === 'object' && priorArt.abstract) ? priorArt.abstract : 
                 (typeof priorArt === 'string' ? priorArt.substring(0, 300) : 'Generated patent abstract for innovative system'),
        field: (typeof legal === 'object' && legal.field) ? legal.field : 
               'Field of technology related to the disclosed invention',
        background: (typeof legal === 'object' && legal.background) ? legal.background : 
                   (typeof legal === 'string' ? legal.substring(0, 500) : 'Background of the invention and prior art considerations'),
        summary: (typeof legal === 'object' && legal.summary) ? legal.summary : 
                'Summary of the disclosed invention and its advantages',
        claims: (typeof claims === 'object' && claims.claims) ? claims.claims : 
               (typeof claims === 'string' ? claims : '1. A system comprising novel technical elements.'),
        drawings: (typeof priorArt === 'object' && priorArt.drawings) ? priorArt.drawings : 
                 'Technical drawings showing system components and interactions',
        description: (typeof legal === 'object' && legal.description) ? legal.description : 
                    (typeof legal === 'string' ? legal : 'Detailed description of the invention')
      };

      console.log('Draft successfully assembled using text extraction');
      
    } catch (parseError) {
      console.error('All parsing approaches failed:', parseError);
      console.error('Raw responses for debugging:', {
        technicalAnalysis: technicalAnalysis?.substring(0, 200),
        legalFormatted: legalFormatted?.substring(0, 200),
        expandedClaims: expandedClaims?.substring(0, 200),
        priorArtDifferentiated: priorArtDifferentiated?.substring(0, 200)
      });
      
      // Final fallback - create basic draft
      draft = {
        abstract: 'AI-generated patent abstract for innovative system and method',
        field: 'Technical field related to the disclosed invention',
        background: 'Background information about the problem solved by this invention',
        summary: 'Summary of the novel approach and technical advantages',
        claims: '1. A system for implementing the disclosed invention.',
        drawings: 'Technical drawings illustrating the system components',
        description: 'Detailed technical description of the implementation'
      };
      
      console.log('Using fallback draft structure');
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