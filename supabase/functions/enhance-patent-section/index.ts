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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch session data, prior art, and existing sections
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

    // Fetch prior art results for differentiation context
    const { data: priorArtResults } = await supabase
      .from('prior_art_results')
      .select('title, summary, similarity_score, overlap_claims, difference_claims')
      .eq('session_id', session_id)
      .order('similarity_score', { ascending: false })
      .limit(5);

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

    // Build prior art differentiation context
    let priorArtContext = '';
    if (priorArtResults && priorArtResults.length > 0) {
      priorArtContext = '\n\nPRIOR ART TO DIFFERENTIATE FROM:\n';
      priorArtResults.forEach((result, i) => {
        priorArtContext += `${i + 1}. "${result.title}" (${Math.round((result.similarity_score || 0) * 100)}% similar)\n`;
        if (result.overlap_claims?.length) {
          priorArtContext += `   Overlapping aspects: ${result.overlap_claims.slice(0, 3).join(', ')}\n`;
        }
        if (result.difference_claims?.length) {
          priorArtContext += `   Key differentiators: ${result.difference_claims.slice(0, 3).join(', ')}\n`;
        }
      });
      priorArtContext += '\nIMPORTANT: Emphasize how this invention differs from the above prior art.';
    }

    const fullPrompt = `${sectionPrompt}

Invention Idea: ${session.idea_prompt}

Additional Context from Q&A:
${qaContext}
${priorArtContext}

Requirements:
- Use professional patent application language
- Be technically precise and comprehensive
- Follow USPTO formatting guidelines
- Include specific details and technical specifications
- Ensure novelty and non-obviousness are clear
- Clearly differentiate from prior art where applicable`;

    // Call Lovable AI
    const model = section_type === 'claims' ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash';
    
    const lovableResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
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
        max_tokens: section_type === 'description' ? 2000 : 1000,
        temperature: 0.2,
      }),
    });

    if (!lovableResponse.ok) {
      const errorText = await lovableResponse.text();
      console.error('Lovable AI error:', errorText);
      
      if (lovableResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (lovableResponse.status === 402) {
        throw new Error('AI credits depleted. Please add credits to continue.');
      }
      
      throw new Error(`Lovable AI API error: ${lovableResponse.statusText}`);
    }

    const lovableData = await lovableResponse.json();
    const enhancedContent = lovableData.choices[0]?.message?.content;

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
    const errMessage = error instanceof Error ? error.message : 'Failed to enhance patent section';
    return new Response(
      JSON.stringify({ success: false, error: errMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});