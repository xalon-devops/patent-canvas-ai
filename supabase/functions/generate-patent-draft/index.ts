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

    // Stage 1: Legal-Grade Technical Analysis using USPTO Guidelines
    console.log('Stage 1: Legal-Grade Technical Analysis (USPTO Compliant)');
    const technicalExtractionPrompt = `You are a USPTO-certified patent examiner and technical expert. Perform a comprehensive technical analysis of this invention following USPTO MPEP guidelines.

CRITICAL REQUIREMENTS:
1. Identify ALL technical elements that could form the basis of patentable claims
2. Categorize innovations by statutory classes (35 U.S.C. § 101): process, machine, manufacture, composition of matter
3. Determine technical improvements over prior art
4. Identify specific, concrete implementations (avoid abstract ideas per Alice/Mayo)
5. Extract measurable technical specifications where possible

ANALYSIS FRAMEWORK:
- TECHNICAL ELEMENTS: Specific hardware, software, chemical, mechanical components
- FUNCTIONAL RELATIONSHIPS: How components interact to achieve technical objectives  
- NOVEL MECHANISMS: New processes, algorithms, chemical reactions, mechanical operations
- TECHNICAL ADVANTAGES: Measurable improvements (speed, efficiency, accuracy, etc.)
- IMPLEMENTATION DETAILS: Specific materials, dimensions, parameters, protocols
- CLAIM-WORTHY FEATURES: Elements that could form independent/dependent claims

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. The JSON must have these exact keys:
{
  "technical_elements": ["specific technical component descriptions"],
  "functional_relationships": ["component A interacts with component B to achieve C"],
  "novel_mechanisms": ["detailed process/mechanism descriptions"],
  "technical_advantages": ["measurable improvement over prior art"],
  "implementation_specifics": ["concrete technical details"],
  "statutory_class": "process|machine|manufacture|composition",
  "claim_worthy_features": ["features suitable for patent claims"]
}`;

    const technicalAnalysis = await callOpenAI(technicalExtractionPrompt, 
      `Invention Idea: ${idea_prompt}\n\nQ&A Results:\n${qa_text}`);

    // Stage 2: USPTO-Compliant Legal Document Structuring
    console.log('Stage 2: USPTO-Compliant Legal Document Structuring');
    const legalFormattingPrompt = `You are a USPTO-registered patent attorney specializing in patent prosecution. Transform the technical analysis into legally compliant patent sections following USPTO MPEP Chapter 600 guidelines.

LEGAL REQUIREMENTS PER USPTO MPEP:
1. FIELD OF INVENTION (35 U.S.C. § 112(a)): Must clearly indicate field of art to which invention pertains
2. BACKGROUND (35 U.S.C. § 112(a)): Describe prior art problems, limitations, and need for invention
3. SUMMARY (35 U.S.C. § 112(a)): Concise summary of invention and its advantages
4. DETAILED DESCRIPTION (35 U.S.C. § 112(a)): Enable person skilled in art to make and use invention

LEGAL LANGUAGE REQUIREMENTS:
- Use present tense for describing invention
- Use past tense for describing prior art
- Avoid subjective terms ("better," "superior") - use objective technical language
- Include enablement details (materials, dimensions, parameters)
- Reference figure numbers where applicable
- Use claim language consistency throughout specification

TECHNICAL WRITING STANDARDS:
- Precise terminology throughout
- Consistent component naming
- Quantitative specifications where possible
- Clear cause-and-effect relationships
- Avoid vague terms ("substantially," "about" only when necessary)

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. The JSON must have these exact keys:
{
  "field": "Technical field statement following MPEP 608.01(c)",
  "background": "Prior art description and problem statement per MPEP 608.01(c)", 
  "summary": "Invention summary with advantages per MPEP 608.01(d)",
  "description": "Detailed enablement description per 35 U.S.C. § 112(a)"
}`;

    const legalFormatted = await callOpenAI(legalFormattingPrompt, technicalAnalysis);

    // Stage 3: Professional Claims Drafting (35 U.S.C. § 112(b))
    console.log('Stage 3: Professional Claims Drafting (35 U.S.C. § 112(b))');
    const claimsExpansionPrompt = `You are a USPTO-registered patent attorney specializing in claim drafting. Generate legally compliant patent claims following 35 U.S.C. § 112(b) and MPEP Chapter 2100.

CLAIM DRAFTING REQUIREMENTS (35 U.S.C. § 112(b)):
1. Claims must particularly point out and distinctly claim the subject matter
2. Independent claims must be complete and standalone
3. Dependent claims must refer back to and further limit preceding claims
4. Use clear antecedent basis (first mention "a," subsequent "the")
5. Avoid vague terms, use definite language
6. Ensure claim scope is supported by specification

CLAIM STRUCTURE RULES:
- Start with preamble identifying statutory class
- Include transitional phrase ("comprising," "consisting of," "consisting essentially of")
- List claim elements with clear limitations
- Use consistent terminology from specification
- Number claims sequentially
- Ensure dependent claims add meaningful limitations

CLAIM TYPES TO GENERATE:
- 1-3 Independent claims (system, method, apparatus)
- 3-7 Dependent claims per independent claim
- Include apparatus claims and method claims if applicable
- Cover different embodiments and variations

LEGAL LANGUAGE REQUIREMENTS:
- Use "comprising" for open-ended claims
- Use "consisting of" for closed claims
- Avoid "means plus function" unless absolutely necessary
- Use definite articles properly
- Ensure measurable/definite limitations

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. The JSON must have this exact structure:
{
  "claims": "Patent claims formatted with proper numbering, dependencies, and legal language"
}`;

    const expandedClaims = await callOpenAI(claimsExpansionPrompt, 
      `Technical Analysis: ${technicalAnalysis}\n\nLegal Formatted: ${legalFormatted}`);

    // Stage 4: USPTO Abstract & Drawing Descriptions (37 CFR 1.72)
    console.log('Stage 4: USPTO Abstract & Drawing Descriptions (37 CFR 1.72)');
    const priorArtPrompt = `You are a USPTO patent examiner specializing in abstracts and drawing descriptions. Generate USPTO-compliant abstract and drawing descriptions per 37 CFR 1.72.

ABSTRACT REQUIREMENTS (37 CFR 1.72):
1. Concise summary of technical disclosure (preferably 50-150 words)
2. Indicate technical field and nature of invention
3. Describe problem solved and solution provided
4. Highlight key technical features and advantages
5. Avoid claims language and commercial significance
6. Use present tense, objective language
7. No references to drawings or examples

DRAWING DESCRIPTION REQUIREMENTS (35 U.S.C. § 112(a)):
1. Brief description of each drawing figure
2. Explain relationship between drawings and invention
3. Identify key components and reference numerals
4. Describe views (plan, elevation, perspective, etc.)
5. Note any special drawing features (exploded views, cross-sections)
6. Ensure drawings enable understanding of invention

TECHNICAL STANDARDS:
- Precise, technical language avoiding marketing terms
- Focus on novel technical aspects
- Clear differentiation from prior art
- Measurable advantages where possible
- Consistent terminology with specification

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. The JSON must have these exact keys:
{
  "abstract": "USPTO-compliant abstract (50-150 words) per 37 CFR 1.72",
  "drawings": "Brief description of drawings per 35 U.S.C. § 112(a)"
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