import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  session_id?: string;
  question: string;
  answer: string;
  github_url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { session_id, question, answer, github_url }: RequestBody = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Collect contextual knowledge for the session if available
    let session: any = null;
    let priorArt: any[] = [];
    let sections: any[] = [];
    let qaPairs: any[] = [];
    let docs: any[] = [];

    if (session_id) {
      const [s, q, sec, pa, d] = await Promise.all([
        supabase.from('patent_sessions').select('*').eq('id', session_id).maybeSingle(),
        supabase.from('ai_questions').select('question, answer').eq('session_id', session_id),
        supabase.from('patent_sections').select('section_type, content').eq('session_id', session_id),
        supabase.from('prior_art_results').select('title, summary, similarity_score').eq('session_id', session_id).order('similarity_score', { ascending: false }),
        supabase.from('patent_documents').select('file_name, document_type, ai_analysis, extraction_data').eq('patent_session_id', session_id)
      ]);

      if (!s.error) session = s.data;
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
    }
    if (github_url) parts.push(`GitHub: ${github_url}`);
    if (sections?.length) {
      const joined = sections.slice(0, 6).map((s) => `# ${s.section_type}\n${(s.content || '').slice(0, 1000)}`).join('\n\n');
      parts.push(`Sections:\n${joined}`);
    }
    if (qaPairs?.length) {
      const joined = qaPairs.slice(0, 8).map((qa) => `Q: ${qa.question}\nA: ${qa.answer || ''}`).join('\n\n');
      parts.push(`Q&A so far:\n${joined}`);
    }
    if (priorArt?.length) {
      const joined = priorArt.slice(0, 5).map((p) => `- ${p.title} :: ${(p.similarity_score*100 || 0).toFixed(1)}%\n${p.summary || ''}` ).join('\n');
      parts.push(`Relevant prior art:\n${joined}`);
    }
    if (docs?.length) {
      const joined = docs.slice(0, 3).map((d) => `Doc: ${d.file_name} [${d.document_type}]\n${(d.ai_analysis || JSON.stringify(d.extraction_data || '')).slice(0, 1200)}`).join('\n\n');
      parts.push(`Uploaded documents:\n${joined}`);
    }

    const context = parts.join('\n\n').slice(0, 12000);

    const systemPrompt = `You are a senior patent-drafting assistant. Enhance the user's short answer into a clearer, more specific, and technically accurate response.
- Use ONLY the provided context. Do not invent capabilities or details.
- Preserve the user's intent and voice. Prefer concise, structured paragraphs and bullet points.
- Add concrete specifics (components, data flows, parameters) only if present in the context.
- Make it suitable for a patent application intake form.
Return ONLY the enhanced answer text without any surrounding commentary.`;

    const userPrompt = `QUESTION:\n${question}\n\nUSER'S SHORT ANSWER:\n${answer}\n\nCONTEXT (for reference):\n${context}`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('enhance-answer OpenAI error:', txt);
      return new Response(JSON.stringify({ error: 'OpenAI request failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const enhanced = data?.choices?.[0]?.message?.content?.trim() || '';

    return new Response(
      JSON.stringify({ success: true, enhancedAnswer: enhanced }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in enhance-answer:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
