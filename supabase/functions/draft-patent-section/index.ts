import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  requireSessionAccess, fetchWithTimeout, aiGatewayError, saveSection, isSectionType,
  sectionContentForExport,
} from '../_shared/http.ts';

interface RequestBody {
  session_id?: string;
  section_type?: string;
  user_input?: string;
}

// Legacy aliases -> values allowed by patent_sections.section_type CHECK
const SECTION_ALIASES: Record<string, string> = {
  detailed_description: 'description',
  'detailed-description': 'description',
  brief_description_of_drawings: 'drawings',
  field_of_invention: 'field',
};

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const caller = await authenticate(req);
    const body = await readJson<RequestBody>(req, 200_000);
    const rawType = String(body.section_type || '').trim().toLowerCase();
    const section_type = SECTION_ALIASES[rawType] || rawType;
    if (!isSectionType(section_type)) {
      throw new HttpError(400, 'A valid section_type is required (abstract, field, background, summary, claims, drawings, description).');
    }
    const user_input = typeof body.user_input === 'string' ? body.user_input.slice(0, 10_000) : '';

    // Ownership check before using the service-role client
    const session = await requireSessionAccess(caller, body.session_id);
    const session_id: string = session.id;
    const supabaseClient = caller.admin;

    console.log(`Drafting ${section_type} section for session:`, session_id);

    const [questionsResult, existingSectionsResult] = await Promise.all([
      supabaseClient
        .from('ai_questions')
        .select('question, answer')
        .eq('session_id', session_id)
        .not('answer', 'is', null),
      supabaseClient
        .from('patent_sections')
        .select('section_type, content')
        .eq('session_id', session_id)
    ]);

    const questions = questionsResult.data || [];
    const existingSections = (existingSectionsResult.data || []).filter((s: any) => s.section_type !== section_type);

    // Build comprehensive context
    const inventionContext = `
    Invention Title: ${String(session.idea_prompt || '').slice(0, 20000)}
    Patent Type: ${session.patent_type}
    Technical Analysis: ${String(session.technical_analysis || '').slice(0, 15000)}
    
    Detailed Q&A:
    ${questions.map((q: any) => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n')}
    
    Existing Sections:
    ${existingSections.map((s: any) => `${s.section_type}:\n${sectionContentForExport(s.section_type, s.content).slice(0, 8000)}`).join('\n\n')}
    
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
      
      'field': `Write the Field of the Invention section: 1-3 sentences identifying the technical field the invention pertains to. Use formal patent language.`,

      'description': `Write the Detailed Description section. Include:
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

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new HttpError(500, 'AI service is not configured.');
    }

    const response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: inventionContext }
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    }, 90_000);

    if (!response.ok) throw await aiGatewayError(response, 'draft-patent-section');

    const aiResponse = await response.json().catch(() => null);
    const sectionContent = String(aiResponse?.choices?.[0]?.message?.content ?? '').trim();
    if (!sectionContent) throw new HttpError(502, 'The AI returned an empty section. Please try again.');

    await saveSection(supabaseClient, session_id, section_type, sectionContent);

    return jsonResponse({
      success: true,
      section_type,
      content: sectionContent,
      word_count: sectionContent.split(/\s+/).length
    });

  } catch (error) {
    return errorResponse(error, 'Failed to draft section', 'draft-patent-section');
  }
});
