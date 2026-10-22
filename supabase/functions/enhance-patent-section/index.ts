import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  requireSessionAccess, fetchWithTimeout, aiGatewayError, saveSection, isSectionType,
  invokeFunctionAsService,
} from '../_shared/http.ts';

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const caller = await authenticate(req);
    const { session_id: rawSessionId, section_type } = await readJson<{ session_id?: string; section_type?: string }>(req, 16_000);

    if (!rawSessionId || !section_type) {
      throw new HttpError(400, 'session_id and section_type are required');
    }
    if (!isSectionType(section_type)) {
      throw new HttpError(400, 'Invalid section_type');
    }

    // Ownership check before using the service-role client
    const session = await requireSessionAccess(caller, rawSessionId, 'id, user_id, idea_prompt');
    const session_id: string = session.id;
    const supabase = caller.admin;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new HttpError(500, 'AI service is not configured.');

    // Drawings are image figures produced by generate-patent-diagrams
    if (section_type === 'drawings') {
      const res = await invokeFunctionAsService('generate-patent-diagrams', {
        session_id,
        context: String(session.idea_prompt || '').slice(0, 1000),
      }, 140_000);
      if (!res || !res.ok) throw new HttpError(502, 'Failed to regenerate drawings. Please try again.');
      return jsonResponse({ success: true, section_type, model_used: 'google/gemini-2.5-flash-image-preview', content_length: 0 });
    }

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
      
      field: `Write the Field of the Invention section that:
- States in 1-3 sentences the technical field the invention pertains to
- Is specific but not overly narrow
- Uses formal patent application language`,

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
    const qaContext = questions?.map((q: any) => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n') || '';

    // Build prior art differentiation context
    let priorArtContext = '';
    if (priorArtResults && priorArtResults.length > 0) {
      priorArtContext = '\n\nPRIOR ART TO DIFFERENTIATE FROM:\n';
      priorArtResults.forEach((result: any, i: number) => {
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

Invention Idea: ${String(session.idea_prompt || '').slice(0, 20000)}

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
    
    const lovableResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
    }, 120_000);

    if (!lovableResponse.ok) throw await aiGatewayError(lovableResponse, 'enhance-patent-section');

    const lovableData = await lovableResponse.json().catch(() => null);
    const enhancedContent = String(lovableData?.choices?.[0]?.message?.content ?? '').trim();

    if (!enhancedContent) {
      throw new HttpError(502, 'Failed to generate enhanced content. Please try again.');
    }

    // patent_sections has no UNIQUE(session_id, section_type), so upsert(onConflict) always failed.
    await saveSection(supabase, session_id, section_type, enhancedContent);

    return jsonResponse({
      success: true,
      section_type,
      model_used: model,
      content_length: enhancedContent.length
    });

  } catch (error) {
    return errorResponse(error, 'Failed to enhance patent section', 'enhance-patent-section');
  }
});
