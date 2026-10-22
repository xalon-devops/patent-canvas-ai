import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  requireSessionAccess, fetchWithTimeout, aiGatewayError, parseModelJson, assertPublicHttpUrl,
} from '../_shared/http.ts';

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    console.log('Ask followups function started');

    const caller = await authenticate(req);
    const body = await readJson<{ session_id?: string; idea_prompt?: string }>(req, 200_000);
    const { session_id } = body;
    const idea_prompt = typeof body.idea_prompt === 'string' ? body.idea_prompt.slice(0, 50_000) : '';

    if (!session_id || !idea_prompt.trim()) {
      throw new HttpError(400, 'session_id and idea_prompt are required');
    }

    // Ownership check before any service-role reads/writes
    const ownedSession = await requireSessionAccess(caller, session_id, 'id, user_id, technical_analysis, data_source');

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new HttpError(500, 'AI service is not configured.');

    const supabase = caller.admin;

    // Enhanced URL detection
    const trimmedPrompt = idea_prompt.trim().toLowerCase();
    const isUrl = !/\s/.test(trimmedPrompt) && (
                  trimmedPrompt.startsWith('http') ||
                  trimmedPrompt.startsWith('www.') ||
                  /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmedPrompt));
    
    let contextualInfo = '';
    let actualUrl = idea_prompt.trim();
    
    if (isUrl) {
      // Normalize + SSRF guard (no localhost / private network targets)
      try {
        actualUrl = assertPublicHttpUrl(actualUrl);
      } catch {
        actualUrl = '';
      }
      
      console.log('Detected URL input, crawling content:', actualUrl);
      
      try {
        if (!actualUrl) {
          console.warn('Skipping crawl of non-public URL');
        } else if (firecrawlApiKey) {
          // Use Firecrawl for JavaScript-rendered content
          console.log('Using Firecrawl to scrape JavaScript-rendered content:', actualUrl);
          console.log('Firecrawl API key present:', firecrawlApiKey ? 'YES' : 'NO');
          
          const firecrawlResponse = await fetchWithTimeout('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${firecrawlApiKey}`,
            },
            body: JSON.stringify({
              url: actualUrl,
              formats: ['markdown'],
              waitFor: 2000,
              timeout: 30000
            })
          }, 40_000);

          console.log('Firecrawl response status:', firecrawlResponse.status);

          if (firecrawlResponse.ok) {
            const firecrawlData = await firecrawlResponse.json();
            
            if (firecrawlData.success && firecrawlData.data) {
              const extractedContent = firecrawlData.data.markdown || firecrawlData.data.text || '';
              console.log('Firecrawl extracted content length:', extractedContent.length);
              console.log('First 500 chars of Firecrawl content:', extractedContent.substring(0, 500));
              
              if (extractedContent.length > 100) {
                // Limit content to approximately 2000 tokens (roughly 8000 characters)
                contextualInfo = extractedContent.length > 8000 
                  ? extractedContent.substring(0, 8000) + '... [content truncated]'
                  : extractedContent;
                console.log('Successfully extracted website content using Firecrawl');
              } else {
                console.warn('Firecrawl extracted very little content:', extractedContent);
                contextualInfo = extractedContent;
              }
            } else {
              console.warn('Firecrawl returned unsuccessful response:', firecrawlData);
            }
          } else {
            const errorText = await firecrawlResponse.text();
            console.warn('Firecrawl API error:', firecrawlResponse.status, errorText);
          }
        } else {
          console.log('No Firecrawl API key, falling back to basic fetch');
          
          // Fallback to basic fetch if no Firecrawl API key
          const crawlResponse = await fetch(actualUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PatentBot/1.0; Patent Analysis)',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(15000)
          });

          if (crawlResponse.ok) {
            const html = await crawlResponse.text();
            let textContent = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<!--[\s\S]*?-->/g, '')
              .replace(/<[^>]*>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\s+/g, ' ')
              .trim();

            contextualInfo = textContent.length > 8000 
              ? textContent.substring(0, 8000) + '... [content truncated]'
              : textContent;
            
            console.log('Fallback extraction completed, content length:', contextualInfo.length);
          }
        }
      } catch (crawlError) {
        console.error('Error crawling URL:', crawlError);
        // Continue without crawled content
      }
    }

    console.log('About to call Lovable AI with context length:', contextualInfo.length);

    console.log('Calling Lovable AI for follow-up questions');
    
    // Check if there's existing technical analysis from GitHub/code analysis
    const technicalAnalysis = ownedSession;
    
    // Check if we have rich backend data - if so, generate fewer questions
    const hasRichBackendData = technicalAnalysis?.data_source?.supabase_backend?.statistics?.tables_found > 0 ||
                                technicalAnalysis?.data_source?.supabase_backend?.statistics?.functions_found > 0;
    
    // Create the system prompt with optional contextual information
    let systemPrompt = `You are a USPTO-registered patent attorney specializing in invention disclosure interviews. Your task is to generate ${hasRichBackendData ? '2-4' : '4-8'} targeted questions that will extract all necessary technical and legal information for a comprehensive patent application per 35 U.S.C. § 112.

${hasRichBackendData ? 'NOTE: We already have detailed backend analysis from the user\'s Supabase database. Focus ONLY on gaps in the information - ask about business logic, novel algorithms, or unique technical approaches that wouldn\'t be obvious from database structure alone. Keep questions minimal and high-value.\n\n' : ''}

CRITICAL PATENT REQUIREMENTS TO ADDRESS:
1. ENABLEMENT (35 U.S.C. § 112(a)): Enable person skilled in art to make and use invention
2. WRITTEN DESCRIPTION (35 U.S.C. § 112(a)): Show possession of claimed invention
3. BEST MODE (35 U.S.C. § 112(a)): Disclose best mode contemplated by inventor
4. DEFINITENESS (35 U.S.C. § 112(b)): Particularly point out and distinctly claim subject matter

QUESTION CATEGORIES (Generate 1-2 questions per category):
A. TECHNICAL IMPLEMENTATION: Specific components, materials, dimensions, processes, algorithms
B. FUNCTIONAL RELATIONSHIPS: How components interact, data flow, operational sequences
C. NOVEL ASPECTS: What's new/different from existing solutions, technical improvements
D. ALTERNATIVE EMBODIMENTS: Variations, optional features, different implementations
E. TECHNICAL ADVANTAGES: Measurable benefits, performance improvements, problem resolution
F. ENABLEMENT DETAILS: Manufacturing methods, specific parameters, operational conditions

LEGAL DRAFTING FOCUS:
- Extract claim-worthy technical features
- Identify independent vs dependent claim elements
- Gather enablement details for specification
- Understand commercial significance for prosecution

QUESTION QUALITY STANDARDS:
- Ask specific, technical questions (avoid vague "how does it work?")
- Focus on measurable, definite features
- Seek concrete implementation details
- Target patentable subject matter elements
- Avoid abstract concepts, focus on concrete technology

IMPORTANT: Return your response as a valid JSON array of strings, where each string is a targeted follow-up question. The response should be ONLY the JSON array, no additional text or formatting.

Example format: ["What specific materials or components are required for the core mechanism?", "How does component A interface with component B to achieve the technical result?", "What measurable improvements does this provide over existing solutions?"]

CRITICAL: Your response must be ONLY a JSON array starting with [ and ending with ]. No markdown code blocks, no extra text, JUST the JSON array.`;

    // Add technical analysis if available (from GitHub/code analysis)
    if (technicalAnalysis?.technical_analysis) {
      systemPrompt += `\n\nEXISTING TECHNICAL ANALYSIS FROM CODE:\n${String(technicalAnalysis.technical_analysis).slice(0, 20000)}\n\nBased on this technical analysis, generate specific, contextual questions that dig deeper into the unique technical aspects, implementation details, and novel features identified in the code. Avoid generic questions - focus on the specific technical innovations mentioned in the analysis.`;
    }
    
    // Add backend data summary if available
    if (hasRichBackendData && technicalAnalysis?.data_source?.supabase_backend) {
      const backend = technicalAnalysis.data_source.supabase_backend;
      systemPrompt += `\n\nEXISTING BACKEND ANALYSIS:\nTables: ${backend.statistics?.tables_found || 0}\nFunctions: ${backend.statistics?.functions_found || 0}\nStorage: ${backend.statistics?.storage_buckets_found || 0}\n\nWe have detailed database schema and backend structure. Only ask questions about aspects NOT captured by database design (e.g., novel algorithms, business rules, user experience innovations, specific technical problems solved).`;
    }
    
    // Add contextual information if we crawled a URL
    if (contextualInfo) {
      systemPrompt += `\n\nAdditional context from the provided URL:\n${contextualInfo}`;
    }

    let userPrompt = technicalAnalysis?.technical_analysis 
      ? `Based on the technical analysis above, the user's invention relates to: ${idea_prompt}

Generate ${hasRichBackendData ? '2-4' : '4-8'} targeted follow-up questions.

Return as JSON object with this structure:
{
  "questions": ["Question 1?", "Question 2?", "Question 3?"]
}`
      : `Initial invention idea: ${idea_prompt}

Generate ${hasRichBackendData ? '2-4' : '4-8'} targeted follow-up questions to gather missing information.

Return as JSON object with this structure:
{
  "questions": ["Question 1?", "Question 2?", "Question 3?"]
}`;

    // Call Lovable AI to generate follow-up questions
    const aiResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      })
    }, 60_000);

    if (!aiResponse.ok) throw await aiGatewayError(aiResponse, 'ask-followups');

    const aiData = await aiResponse.json().catch(() => null);
    const generatedContent: string = String(aiData?.choices?.[0]?.message?.content ?? '');

    console.log('Lovable AI response received, parsing questions');
    console.log('Raw AI response:', generatedContent);

    let questions: string[] = [];
    const parsed = parseModelJson(generatedContent);
    const candidate = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.questions) ? parsed.questions : null);
    if (candidate) {
      questions = candidate;
    } else {
      // Last resort: try to extract question-like strings
      const lines = generatedContent.split('\n').filter((l: string) => l.trim());
      questions = lines
        .filter((l: string) => l.includes('?'))
        .map((q: string) => q.replace(/^\s*\d+[.)]\s*/, '').replace(/^\s*[-*]\s*/, '').replace(/^"|",?$/g, '').trim());
    }
    questions = questions
      .filter((q: unknown) => typeof q === 'string' && q.trim().length > 5)
      .map((q: string) => q.trim().slice(0, 1000))
      .slice(0, 10);

    if (questions.length === 0) {
      console.error('Failed to parse AI questions from:', generatedContent.slice(0, 500));
      throw new HttpError(502, 'Failed to generate follow-up questions. Please try again.');
    }
    console.log('Parsed', questions.length, 'questions');

    // Prepare questions for database insertion
    const questionRecords = questions.map((question: string) => ({
      session_id,
      question: question.trim(),
      answer: null,
    }));

    console.log(`Inserting ${questionRecords.length} questions into database`);

    // Clear existing questions for this session and insert new ones
    const { error: deleteError } = await supabase
      .from('ai_questions')
      .delete()
      .eq('session_id', session_id);

    if (deleteError) {
      console.warn('Error clearing existing questions:', deleteError);
    }

    const { error: insertError } = await supabase
      .from('ai_questions')
      .insert(questionRecords);

    if (insertError) {
      console.error('Error inserting questions:', insertError);
      throw new HttpError(500, 'Failed to save questions');
    }

    console.log('Follow-up questions generated and saved successfully');

    return jsonResponse({
      success: true,
      saved: true,
      questions_generated: questionRecords.length,
      url_crawled: isUrl,
      context_length: contextualInfo.length,
    });

  } catch (error) {
    return errorResponse(error, 'Failed to generate follow-up questions', 'ask-followups');
  }
});