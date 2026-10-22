import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  requireSessionAccess, fetchWithTimeout, aiGatewayError, saveSection, markDraftComplete,
  invokeFunctionAsService, type PatentSectionType,
} from '../_shared/http.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const caller = await authenticate(req);
    const { session_id: rawSessionId } = await readJson<{ session_id?: string }>(req, 64_000);
    if (!LOVABLE_API_KEY) throw new HttpError(500, 'AI service is not configured.');

    // Ownership check before using the service-role client
    const sessionData = await requireSessionAccess(caller, rawSessionId);
    const session_id: string = sessionData.id;
    const supabaseClient = caller.admin;

    console.log('[ENHANCED DRAFT - LOVABLE AI] Starting iterative patent generation');

    const { data: aiQuestions, error: questionsError } = await supabaseClient
      .from('ai_questions')
      .select('question, answer')
      .eq('session_id', session_id);

    if (questionsError) {
      console.error('[ENHANCED DRAFT] Questions fetch error:', questionsError);
    }

    // Build context (bounded so prompts stay within model limits)
    let context = `INVENTION IDEA: ${String(sessionData.idea_prompt || 'Not provided').slice(0, 20000)}\n\n`;
    context += 'Q&A DETAILS:\n';
    aiQuestions?.forEach((q: any) => {
      if (q.answer) {
        context += `Q: ${q.question}\nA: ${String(q.answer).slice(0, 4000)}\n\n`;
      }
    });

    // Add Supabase backend analysis if available
    if (sessionData.data_source?.supabase_backend) {
      context += '\n\nSUPABASE BACKEND ARCHITECTURE:\n';
      context += JSON.stringify(sessionData.data_source.supabase_backend, null, 2).slice(0, 15000);
    }

    const textSectionTypes: PatentSectionType[] = ['abstract', 'field', 'background', 'summary', 'claims', 'description'];

    // Diagrams run concurrently with the text sections (service-role call; it writes the 'drawings' section)
    const diagramsPromise = invokeFunctionAsService('generate-patent-diagrams', {
      session_id,
      context: context.substring(0, 1000),
    }, 140_000);

    // Generate text sections in parallel; one failing section must not discard the others
    const results = await Promise.allSettled(textSectionTypes.map(async (sectionType) => {
      console.log(`[ENHANCED DRAFT] Generating ${sectionType}...`);
      const prompt = getSectionPrompt(sectionType, context);
      const content = await callLovableAI(prompt, sectionType);
      const qualityScore = calculateQualityScore(content, sectionType);

      // Store iteration for transparency (non-fatal)
      const { error: iterErr } = await supabaseClient.from('draft_iterations').insert({
        session_id,
        iteration_number: 1,
        section_type: sectionType,
        content: content,
        quality_score: qualityScore
      });
      if (iterErr) console.warn(`[ENHANCED DRAFT] draft_iterations insert failed for ${sectionType}:`, iterErr.message);

      await saveSection(supabaseClient, session_id, sectionType, content);
      return sectionType;
    }));

    const completed = results.filter((r) => r.status === 'fulfilled').length;
    const failures = results
      .map((r, i) => (r.status === 'rejected' ? { section: textSectionTypes[i], reason: r.reason } : null))
      .filter(Boolean) as Array<{ section: string; reason: unknown }>;
    failures.forEach((f) => console.error(`[ENHANCED DRAFT] ${f.section} failed:`, f.reason));

    if (completed === 0) {
      const first = failures[0]?.reason;
      if (first instanceof HttpError) throw first;
      throw new HttpError(502, 'Patent draft generation failed. Please try again.');
    }

    const diagramsRes = await diagramsPromise;
    const diagramsOk = !!diagramsRes?.ok;
    if (!diagramsOk) console.warn('[ENHANCED DRAFT] Diagram generation failed or timed out');

    // Mark analysis done; only treat the draft as "complete" once the interview has enough answers
    // (Session.tsx calls this function progressively after every answer).
    await supabaseClient.from('patent_sessions').update({ ai_analysis_complete: true }).eq('id', session_id);
    const total = aiQuestions?.length ?? 0;
    const answered = (aiQuestions ?? []).filter((q: any) => q.answer).length;
    const isFinalDraft = failures.length === 0 && (total === 0 || answered >= Math.min(3, total));
    if (isFinalDraft) {
      await markDraftComplete(supabaseClient, session_id, sessionData.user_id);
    }

    const sectionsGenerated = completed + (diagramsOk ? 1 : 0);
    console.log(`[ENHANCED DRAFT] Complete: ${sectionsGenerated} sections generated with parallel AI processing`);

    return jsonResponse({
      success: true,
      sections_generated: sectionsGenerated,
      failed_sections: failures.map((f) => f.section),
      processing_mode: 'parallel',
      quality_checked: true,
      ai_model: 'google/gemini-2.5-pro'
    });

  } catch (error) {
    return errorResponse(error, 'Patent draft generation failed. Please try again.', 'generate-patent-draft-enhanced');
  }
});

async function callLovableAI(prompt: string, sectionType: string): Promise<string> {
  if (!LOVABLE_API_KEY) {
    throw new HttpError(500, 'AI service is not configured.');
  }

  console.log(`[Lovable AI] Generating ${sectionType}...`);

  // Use gemini-2.5-pro for all sections with generous token limits for comprehensive output
  const model = 'google/gemini-2.5-pro';
  const maxTokens = sectionType === 'description' ? 16000 : 
                    sectionType === 'claims' ? 12000 : 
                    sectionType === 'background' ? 8000 :
                    sectionType === 'summary' ? 10000 : 6000;

  const response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
          content: 'You are a senior USPTO patent attorney with 20+ years of experience drafting patents. Generate extremely detailed, comprehensive, legally compliant patent sections that meet all USPTO requirements. Use professional HTML formatting with proper semantic tags (<h3>, <h4>, <p>, <strong>, <ul>, <ol>, <li>). Never use markdown syntax like ** or ##. Be thorough and verbose - quality patents are detailed and comprehensive. Include specific technical details, multiple embodiments, and exhaustive descriptions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    }),
  }, 140_000);

  if (!response.ok) {
    throw await aiGatewayError(response, `enhanced-draft:${sectionType}`);
  }

  // Parse response with error handling
  let data;
  try {
    const responseText = await response.text();
    console.log(`[Lovable AI] Response length for ${sectionType}: ${responseText.length} chars`);
    
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from Lovable AI');
    }
    
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error(`[Lovable AI] JSON parse error for ${sectionType}:`, parseError);
    throw new HttpError(502, 'The AI service returned an unreadable response. Please try again.');
  }

  // Validate response structure
  if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
    console.error(`[Lovable AI] Invalid response structure for ${sectionType}:`, JSON.stringify(data));
    throw new HttpError(502, 'The AI service returned an empty response. Please try again.');
  }

  // Models sometimes wrap HTML in ```html fences despite instructions
  return String(data.choices[0].message.content)
    .replace(/^\s*```(?:html)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

function getSectionPrompt(sectionType: string, context: string): string {
  const prompts: { [key: string]: string } = {
    abstract: `Write a USPTO-compliant patent abstract in professional HTML format:

${context}

Requirements:
- 150-200 words
- Use proper HTML formatting with <p> tags
- Use <strong> for key terms (NOT markdown **)
- State what the invention is, does, and how it achieves its purpose
- Present tense, third person
- Professional legal language
- Include specific technical details

Return ONLY the HTML content, no markdown.`,

    field: `Write the "Field of the Invention" section in professional HTML format:

${context}

Requirements:
- 3-5 detailed paragraphs wrapped in <p> tags
- Use <strong> for technical field classifications
- Provide comprehensive technical context
- Reference USPTO classification if applicable
- Explain the broader technical domain
- Include related fields and applications
- Professional legal language

Return ONLY the HTML content with proper <p> and <strong> tags.`,

    background: `Write a comprehensive "Background of the Invention" section in professional HTML format:

${context}

Requirements:
- 800-1200 words minimum
- Use <h3> for subsection titles (e.g., "Technical Problem", "Prior Art Limitations", "Industry Need")
- Use <p> tags for paragraphs
- Use <strong> for emphasis on key problems
- Use <ul> and <li> for listing multiple issues or limitations
- Thoroughly describe:
  * The technical problem in detail
  * Current solutions and their specific limitations
  * Industry challenges and unmet needs
  * Technical gaps in existing approaches
  * Why this invention is necessary
- Build a compelling case for patentability
- Professional legal language with technical precision

Return ONLY the HTML content with proper semantic tags.`,

    summary: `Write a comprehensive "Summary of the Invention" section in professional HTML format:

${context}

Requirements:
- 1000-1500 words minimum
- Use <h3> for subsections (e.g., "Overview", "Key Features", "Technical Advantages", "Embodiments")
- Use <p> tags for paragraphs
- Use <strong> for key features and advantages
- Use <ul> and <li> for listing features, advantages, and embodiments
- Thoroughly describe:
  * Comprehensive overview of the invention
  * All key technical features in detail
  * Specific advantages over prior art
  * Multiple embodiments and variations
  * Integration capabilities
  * Scalability and performance benefits
  * Security and reliability features
- Professional legal language with specific technical details
- Each feature should be explained in 2-3 sentences

Return ONLY the HTML content with proper semantic structure.`,

    claims: `Write comprehensive independent and dependent patent claims in professional HTML format:

${context}

Requirements:
- 5-7 independent claims (apparatus, method, system, computer program product, data structure)
- 15-25 dependent claims providing narrow variations
- Format each claim as: <div class="claim"><strong>1.</strong> A method comprising...</div>
- Single sentence per claim with proper semicolons and transitional phrases
- Dependent claims: <div class="claim"><strong>2.</strong> The method of claim 1, wherein...</div>
- Use <strong> for claim numbers
- Include claims for:
  * Method claims (process steps)
  * Apparatus claims (structural elements)
  * System claims (interconnected components)
  * Computer-readable medium claims
  * Data structure claims (for software inventions)
- Each independent claim should be 100-200 words
- Use "comprising", "wherein", "further comprising"
- Proper antecedent basis throughout
- Professional claim drafting language

Return ONLY the HTML content with proper claim formatting.`,

    description: `Write an extremely detailed "Detailed Description of the Invention" section in professional HTML format:

${context}

Requirements:
- 2500-4000 words minimum
- Use <h3> for major sections (e.g., "System Architecture", "Components", "Process Flow", "Embodiments", "Examples")
- Use <h4> for subsections within major sections
- Use <p> tags for paragraphs
- Use <strong> for component names, technical terms
- Use <ul> and <li> for listing features, steps, components
- Use <ol> and <li> for sequential processes
- Provide exhaustive technical details:
  * Complete system architecture
  * Every component and its function
  * Data structures and schemas
  * Process flows and algorithms
  * Integration points and APIs
  * Multiple detailed embodiments
  * Specific implementation examples
  * Performance characteristics
  * Security mechanisms
  * Error handling
  * Edge cases and variations
- Reference figures (e.g., "as shown in FIG. 1")
- Enable someone skilled in the art to make and use the invention
- Include at least 3-5 detailed embodiments
- Professional legal language with extreme technical precision


Return ONLY the HTML content with comprehensive semantic structure.`
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