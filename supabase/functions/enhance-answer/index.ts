import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  requireSessionAccess, fetchWithTimeout, aiGatewayError, sectionContentForExport,
} from '../_shared/http.ts';

interface RequestBody {
  session_id?: string;
  question?: string;
  answer?: string;
  github_url?: string;
}

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const caller = await authenticate(req);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new HttpError(500, 'AI service is not configured.');

    const body = await readJson<RequestBody>(req, 100_000);
    const session_id = body.session_id;
    const question = String(body.question || '').slice(0, 2000);
    const answer = String(body.answer || '').slice(0, 10000);
    const github_url = typeof body.github_url === 'string' ? body.github_url.slice(0, 500) : '';
    if (!answer.trim()) throw new HttpError(400, 'answer is required');

    // Previously this used an anon client without the user's JWT, so RLS returned no context at all.
    // Verify ownership, then read with the service-role client.
    if (session_id) await requireSessionAccess(caller, session_id, 'id, user_id');
    const supabase = caller.admin;

    // Collect contextual knowledge for the session if available
    let session: any = null;
    let priorArt: any[] = [];
    let sections: any[] = [];
    let qaPairs: any[] = [];
    let docs: any[] = [];
    let backendData: any = null;

    if (session_id) {
      const [s, q, sec, pa, d] = await Promise.all([
        supabase.from('patent_sessions').select('idea_prompt, patent_type, technical_analysis, data_source').eq('id', session_id).maybeSingle(),
        supabase.from('ai_questions').select('question, answer').eq('session_id', session_id),
        supabase.from('patent_sections').select('section_type, content').eq('session_id', session_id),
        supabase.from('prior_art_results').select('title, summary, similarity_score').eq('session_id', session_id).order('similarity_score', { ascending: false }),
        supabase.from('patent_documents').select('file_name, document_type, ai_analysis, extraction_data').eq('patent_session_id', session_id)
      ]);

      if (!s.error) {
        session = s.data;
        backendData = session?.data_source?.supabase_backend;
      }
      if (!q.error && q.data) qaPairs = q.data;
      if (!sec.error && sec.data) sections = sec.data;
      if (!pa.error && pa.data) priorArt = pa.data;
      if (!d.error && d.data) docs = d.data;
    }

    // Build a compact context string
    const parts: string[] = [];
    if (session) {
      parts.push(`Invention: ${session.idea_prompt || ''}`);
      parts.push(`Patent Type: ${session.patent_type || ''}`);
      if (session.technical_analysis) {
        parts.push(`Technical Analysis: ${String(session.technical_analysis).slice(0, 1500)}`);
      }
    }
    if (github_url) parts.push(`GitHub: ${github_url}`);
    
    // Add rich Supabase backend context
    if (backendData) {
      const backendParts: string[] = [];
      if (backendData.ai_summary) {
        backendParts.push(`Backend Summary: ${String(backendData.ai_summary).slice(0, 2000)}`);
      }
      if (Array.isArray(backendData.database?.tables)) {
        const tables = backendData.database.tables.slice(0, 10).map((t: any) => 
          `Table ${t.name}: ${t.columns?.slice(0, 8).map((c: any) => c.name).join(', ') || 'N/A'}`
        ).join('\n');
        backendParts.push(`Database Tables:\n${tables}`);
      }
      if (Array.isArray(backendData.functions?.edge_functions)) {
        const funcs = backendData.functions.edge_functions.slice(0, 8).map((f: any) => 
          `Function: ${f.name} - ${f.description || 'N/A'}`
        ).join('\n');
        backendParts.push(`Edge Functions:\n${funcs}`);
      }
      if (Array.isArray(backendData.storage?.buckets)) {
        const buckets = backendData.storage.buckets.map((b: any) => 
          `Bucket: ${b.name} (${b.public ? 'public' : 'private'})`
        ).join(', ');
        backendParts.push(`Storage: ${buckets}`);
      }
      if (backendParts.length) {
        parts.push(`Supabase Backend:\n${backendParts.join('\n\n')}`);
      }
    }
    
    if (sections?.length) {
      const joined = sections.slice(0, 6).map((s) => `# ${s.section_type}\n${sectionContentForExport(s.section_type, s.content).slice(0, 1000)}`).join('\n\n');
      parts.push(`Sections:\n${joined}`);
    }
    if (qaPairs?.length) {
      const joined = qaPairs.slice(0, 8).map((qa) => `Q: ${qa.question}\nA: ${qa.answer || ''}`).join('\n\n');
      parts.push(`Q&A so far:\n${joined}`);
    }
    if (priorArt?.length) {
      const joined = priorArt.slice(0, 5).map((p) => `- ${p.title} :: ${((Number(p.similarity_score) || 0) * 100).toFixed(1)}%\n${p.summary || ''}` ).join('\n');
      parts.push(`Relevant prior art:\n${joined}`);
    }
    if (docs?.length) {
      const joined = docs.slice(0, 3).map((d) => `Doc: ${d.file_name} [${d.document_type}]\n${(d.ai_analysis || JSON.stringify(d.extraction_data || '')).slice(0, 1200)}`).join('\n\n');
      parts.push(`Uploaded documents:\n${joined}`);
    }

    const context = parts.join('\n\n').slice(0, 16000);

    const systemPrompt = `You are a senior patent-drafting assistant. Enhance the user's short answer into a clearer, more specific, and technically accurate response.
- Use ONLY the provided context, including Supabase backend architecture (database tables, edge functions, storage, RLS policies), technical analysis, prior art, Q&A, and documents.
- Leverage technical implementation details from the backend to make answers more specific and patent-worthy.
- Preserve the user's intent and voice. Prefer concise, structured paragraphs and bullet points.
- Add concrete specifics (components, data flows, API endpoints, database schemas, authentication mechanisms) from the context.
- Make it suitable for a patent application intake form with technical depth.
Return ONLY the enhanced answer text without any surrounding commentary.`;

    const userPrompt = `QUESTION:\n${question}\n\nUSER'S SHORT ANSWER:\n${answer}\n\nCONTEXT (for reference):\n${context}`;

    const resp = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    }, 45_000);

    if (!resp.ok) throw await aiGatewayError(resp, 'enhance-answer');

    const data = await resp.json().catch(() => null);
    const enhanced = String(data?.choices?.[0]?.message?.content ?? '').trim();
    if (!enhanced) throw new HttpError(502, 'Could not enhance this answer. Please try again.');

    return jsonResponse({ success: true, enhancedAnswer: enhanced });
  } catch (error) {
    return errorResponse(error, 'Failed to enhance answer', 'enhance-answer');
  }
});
