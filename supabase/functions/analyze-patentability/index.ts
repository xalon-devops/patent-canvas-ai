import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  requireSessionAccess, fetchWithTimeout, aiGatewayError, parseModelJson, toUnitScore,
} from '../_shared/http.ts';

interface RequestBody {
  session_id?: string;
}

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const caller = await authenticate(req);
    const { session_id }: RequestBody = await readJson<RequestBody>(req, 64_000);

    // Ownership check (owner/admin/service) before using the service-role client
    const ownedSession = await requireSessionAccess(caller, session_id);
    const supabaseClient = caller.admin;

    console.log('Analyzing patentability for session:', ownedSession.id);

    const [questionsResult, priorArtResult] = await Promise.all([
      supabaseClient
        .from('ai_questions')
        .select('question, answer')
        .eq('session_id', ownedSession.id),
      supabaseClient
        .from('prior_art_results')
        .select('title, publication_number, similarity_score, assignee, patent_date, overlap_claims, difference_claims, summary')
        .eq('session_id', ownedSession.id)
        .order('similarity_score', { ascending: false })
        .limit(25)
    ]);
    const sessionResult = { data: ownedSession, error: null as unknown };

    if (sessionResult.error) throw sessionResult.error;
    
    const session = sessionResult.data;
    const questions = questionsResult.data || [];
    const priorArt = priorArtResult.data || [];

    // Extract backend data from session
    const backendAnalysis = session.data_source?.supabase_backend || null;
    const backendSummary = backendAnalysis?.ai_summary || '';
    const backendStats = backendAnalysis?.statistics || {};
    
    // Count high-risk prior art
    const highRiskPriorArt = priorArt.filter(p => p.similarity_score >= 0.8);
    const mediumRiskPriorArt = priorArt.filter(p => p.similarity_score >= 0.6 && p.similarity_score < 0.8);

    // Compile all information for analysis
    const inventionContext = `
    Invention: ${String(session.idea_prompt || '').slice(0, 20000)}
    Patent Type: ${session.patent_type}
    Technical Analysis: ${String(session.technical_analysis || 'None provided').slice(0, 15000)}
    
    ${backendAnalysis ? `
    SUPABASE BACKEND ANALYSIS:
    - Tables: ${backendStats.tables_found || 0}
    - Functions: ${backendStats.functions_found || 0}
    - Storage Buckets: ${backendStats.storage_buckets_found || 0}
    - RLS Policies: ${backendStats.rls_policies_found || 0}
    
    Backend Summary:
    ${backendSummary}
    ` : ''}
    
    AI Questions and Answers:
    ${questions.map(q => `Q: ${q.question}\nA: ${q.answer || 'Not answered'}`).join('\n\n')}
    
    PRIOR ART ANALYSIS:
    Total Patents Found: ${priorArt.length}
    High Risk (>80% similar): ${highRiskPriorArt.length}
    Medium Risk (60-80% similar): ${mediumRiskPriorArt.length}
    
    Top 10 Most Similar Patents (DETAILED CLAIM ANALYSIS):
    ${priorArt.slice(0, 10).map((p, idx) => `
    ${idx + 1}. ${p.title}
       Publication: ${p.publication_number}
       Similarity: ${((Number(p.similarity_score) || 0) * 100).toFixed(1)}%
       Assignee: ${p.assignee || 'Unknown'}
       Date: ${p.patent_date || 'Unknown'}
       
       OVERLAPPING CLAIMS (What this patent shares with the invention):
       ${p.overlap_claims && p.overlap_claims.length > 0 
         ? p.overlap_claims.map((claim: string, i: number) => `       ${i + 1}. ${claim}`).join('\n')
         : '       None identified'}
       
       DIFFERENTIATING CLAIMS (What makes the invention unique):
       ${p.difference_claims && p.difference_claims.length > 0
         ? p.difference_claims.map((claim: string, i: number) => `       ${i + 1}. ${claim}`).join('\n')
         : '       None identified'}
       
       Summary: ${p.summary || 'No summary available'}
    `).join('\n\n')}
    `;

    const systemPrompt = `You are a patent attorney AI. Analyze this invention for patentability.

SCORING RULES:
- If prior art >80% similarity exists: Novelty score MUST be <70
- If prior art 60-80% similarity exists: Novelty score 70-80
- Be realistic and evidence-based

Return ONLY valid JSON (no markdown):
{
  "overall_score": 75,
  "criteria": [
    {"name": "Novelty", "score": 75, "maxScore": 100, "description": "How new is the invention?", "analysis": "Brief analysis of overlaps vs differences with cited prior art.", "icon": "Lightbulb"},
    {"name": "Non-obviousness", "score": 70, "maxScore": 100, "description": "Is it obvious to experts?", "analysis": "Brief analysis of whether unique features are obvious combinations.", "icon": "Target"},
    {"name": "Utility", "score": 90, "maxScore": 100, "description": "Does it have useful purpose?", "analysis": "Brief analysis of practical applications.", "icon": "Zap"},
    {"name": "Patent Eligibility", "score": 80, "maxScore": 100, "description": "Is it patentable subject matter?", "analysis": "Brief analysis under Alice/Mayo for software.", "icon": "Award"}
  ],
  "summary": "2-3 sentence summary of patentability prospects.",
  "recommendation": "proceed|refine|reconsider",
  "key_strengths": ["strength1", "strength2"],
  "areas_for_improvement": ["area1", "area2"],
  "risk_factors": ["risk1", "risk2"]
}

Keep each analysis field under 150 words. Be concise.`;

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
        max_tokens: 4000,
      }),
    }, 90_000);

    if (!response.ok) throw await aiGatewayError(response, 'analyze-patentability');

    const aiResponse = await response.json().catch(() => null);
    const rawContent = aiResponse?.choices?.[0]?.message?.content ?? '';

    const analysisResult: any = parseModelJson(rawContent);
    if (!analysisResult || typeof analysisResult !== 'object' || Array.isArray(analysisResult)) {
      console.error('Failed to parse AI response as JSON:', String(rawContent).slice(0, 500));
      throw new HttpError(502, 'The patentability analysis could not be completed. Please try again.');
    }
    // Normalize the shape the frontend renders
    const overall = Number(analysisResult.overall_score);
    analysisResult.overall_score = Number.isFinite(overall) ? Math.max(0, Math.min(100, Math.round(overall <= 1 ? overall * 100 : overall))) : 0;
    if (!Array.isArray(analysisResult.criteria)) analysisResult.criteria = [];
    for (const k of ['key_strengths', 'areas_for_improvement', 'risk_factors']) {
      if (!Array.isArray(analysisResult[k])) analysisResult[k] = [];
    }

    // Update session with patentability score
    // patentability_score is DECIMAL(3,2) in 0..1
    const { error: scoreErr } = await supabaseClient
      .from('patent_sessions')
      .update({
        patentability_score: toUnitScore(analysisResult.overall_score),
        ai_analysis_complete: true
      })
      .eq('id', ownedSession.id);
    if (scoreErr) console.error('Failed to save patentability score:', scoreErr.message);

    return jsonResponse({
      success: true,
      analysis: analysisResult
    });

  } catch (error) {
    return errorResponse(error, 'Patentability analysis failed', 'analyze-patentability');
  }
});