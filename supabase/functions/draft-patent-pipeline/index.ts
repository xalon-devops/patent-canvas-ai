// Multi-Agent Patent Drafting Pipeline
// Orchestrates 6 specialized agents to produce examiner-tested patent drafts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { retrieveMpep, formatMpepContext } from "../_shared/mpep-rag.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL_PRO = "google/gemini-2.5-pro";
const MODEL_FLASH = "google/gemini-2.5-flash";

// ─────────────────────────────────────────────────────────────
// Shared AI call helper
// ─────────────────────────────────────────────────────────────
async function callAI(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  jsonMode?: boolean;
  maxTokens?: number;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: 0.2,
    max_tokens: opts.maxTokens ?? 2000,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) throw new Error("AI rate limit exceeded. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up in workspace billing.");
    throw new Error(`AI Gateway error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    // Strip potential markdown fences
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// AGENT 1: Inventor Interview — synthesize Q&A into a technical brief
// ─────────────────────────────────────────────────────────────
async function interviewAgent(apiKey: string, ideaPrompt: string, qa: Array<{ question: string; answer: string }>) {
  const qaText = qa.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n\n");
  const output = await callAI({
    apiKey,
    model: MODEL_FLASH,
    system:
      "You are a senior patent attorney conducting an inventor interview. Your job is to synthesize raw invention descriptions and Q&A into a crisp technical brief that a claim drafter can rely on. Focus on: technical field, problem solved, solution mechanism, novel elements, key components, and use cases. Be precise.",
    user: `INVENTION:\n${ideaPrompt}\n\nQ&A:\n${qaText || "(none provided)"}\n\nProduce a structured technical brief (400-600 words) with these sections:\n1. Technical Field\n2. Problem Statement\n3. Solution Overview\n4. Novel Technical Elements (bulleted, most important first)\n5. Key Components / Modules\n6. Preferred Embodiments\n7. Identified Context Gaps (what's still unclear)`,
    maxTokens: 1200,
  });
  return output;
}

// ─────────────────────────────────────────────────────────────
// AGENT 2: Prior Art Differentiation
// ─────────────────────────────────────────────────────────────
async function differentiationAgent(
  apiKey: string,
  brief: string,
  priorArt: Array<{ title: string; summary?: string; similarity_score?: number; overlap_claims?: string[]; difference_claims?: string[] }>,
) {
  if (!priorArt || priorArt.length === 0) {
    return "No prior art available. Claims should still emphasize novelty in the technical field.";
  }
  const priorArtText = priorArt
    .slice(0, 5)
    .map(
      (p, i) =>
        `${i + 1}. "${p.title}" (${Math.round((p.similarity_score ?? 0) * 100)}% similar)\n   Summary: ${p.summary?.slice(0, 300) ?? "N/A"}\n   Overlap: ${(p.overlap_claims ?? []).slice(0, 3).join("; ") || "N/A"}\n   Differences: ${(p.difference_claims ?? []).slice(0, 3).join("; ") || "N/A"}`,
    )
    .join("\n\n");

  return await callAI({
    apiKey,
    model: MODEL_PRO,
    system:
      "You are a patent attorney specializing in claim differentiation. Given an invention brief and closely-related prior art, produce a differentiation strategy that highlights what the claims MUST emphasize to avoid §102 (anticipation) and §103 (obviousness) rejections.",
    user: `INVENTION BRIEF:\n${brief}\n\nTOP PRIOR ART:\n${priorArtText}\n\nProduce:\n1. THE NOVELTY ANCHORS — 3-5 specific technical features that MUST appear in claim 1 to distinguish over the prior art\n2. FEATURES TO AVOID CLAIMING — anything that would read directly on the prior art\n3. NON-OBVIOUS COMBINATIONS — element combinations that are non-trivial even to a POSITA\n4. DIFFERENTIATION LANGUAGE — specific claim wording suggestions`,
    maxTokens: 1200,
  });
}

// ─────────────────────────────────────────────────────────────
// AGENT 3: Claim Architect — structured claim tree
// ─────────────────────────────────────────────────────────────
interface ClaimNode {
  claim_number: number;
  claim_type: "independent" | "dependent";
  parent_claim: number | null;
  elements: string[];
  full_text: string;
  rationale: string;
}

async function claimArchitectAgent(
  apiKey: string,
  supabase: SupabaseClient,
  brief: string,
  differentiation: string,
): Promise<ClaimNode[]> {
  // Ground claim drafting in MPEP claim-form and definiteness guidance
  const mpepChunks = await retrieveMpep(
    apiKey,
    supabase,
    `patent claim drafting form comprising transitional phrase antecedent basis definiteness ${brief.slice(0, 500)}`,
    { k: 3 },
  );
  const mpepContext = formatMpepContext(mpepChunks);

  const raw = await callAI({
    apiKey,
    model: MODEL_PRO,
    jsonMode: true,
    system:
      "You are an expert patent claim drafter. Produce a JSON claim tree following USPTO conventions. Independent claims must be broad but novel; dependent claims add narrowing limitations for fallback protection. Use proper claim language ('comprising', 'wherein', etc.). Follow the MPEP guidance provided verbatim on claim form and definiteness.",
    user: `${mpepContext ? `AUTHORITATIVE MPEP GUIDANCE (follow strictly):\n${mpepContext}\n\n` : ""}TECHNICAL BRIEF:\n${brief}\n\nDIFFERENTIATION STRATEGY:\n${differentiation}\n\nReturn ONLY valid JSON in this exact shape (no markdown):\n{\n  "claims": [\n    {\n      "claim_number": 1,\n      "claim_type": "independent",\n      "parent_claim": null,\n      "elements": ["element A", "element B", "element C"],\n      "full_text": "1. A system comprising: ...",\n      "rationale": "Why each element was chosen and how it distinguishes prior art. Cite MPEP sections where applicable."\n    },\n    {\n      "claim_number": 2,\n      "claim_type": "dependent",\n      "parent_claim": 1,\n      "elements": ["adds temperature sensor"],\n      "full_text": "2. The system of claim 1, wherein ...",\n      "rationale": "Fallback in case claim 1 is rejected; still novel because ..."\n    }\n  ]\n}\n\nProduce 1-2 independent claims and 4-8 dependent claims total. Every claim MUST comply with §112(b) definiteness — avoid unbounded terms of degree and preserve antecedent basis.`,
    maxTokens: 3000,
  });
  const parsed = parseJSON<{ claims: ClaimNode[] }>(raw, { claims: [] });
  return parsed.claims ?? [];
}

// ─────────────────────────────────────────────────────────────
// AGENT 4: Specification Writer
// ─────────────────────────────────────────────────────────────
async function specWriterAgent(apiKey: string, supabase: SupabaseClient, brief: string, claims: ClaimNode[]) {
  const claimsText = claims.map((c) => c.full_text).join("\n\n");

  // Ground spec drafting in §112(a) written description + enablement guidance
  const mpepChunks = await retrieveMpep(
    apiKey,
    supabase,
    `written description enablement possession of invention Wands factors specification support for claim limitations ${claimsText.slice(0, 500)}`,
    { k: 3, sectionFilter: "216" },
  );
  const mpepContext = formatMpepContext(mpepChunks);

  const raw = await callAI({
    apiKey,
    model: MODEL_PRO,
    jsonMode: true,
    system:
      "You are a patent specification writer. Produce USPTO-compliant spec sections that fully enable and describe the invention claimed. Every claim element must be described in the specification (§112(a) written description AND enablement). Follow the MPEP guidance provided verbatim.",
    user: `${mpepContext ? `AUTHORITATIVE MPEP GUIDANCE (§112(a) written description & enablement — follow strictly):\n${mpepContext}\n\n` : ""}TECHNICAL BRIEF:\n${brief}\n\nCLAIMS:\n${claimsText}\n\nReturn ONLY valid JSON (no markdown):\n{\n  "abstract": "150-word abstract summarizing the invention",\n  "field": "1-2 sentence technical field statement",\n  "background": "300-500 word background describing the prior art landscape and problems",\n  "summary": "200-400 word summary of the invention and its advantages",\n  "description": "800-1500 word detailed description covering all embodiments and every claim element"\n}\n\nCRITICAL: the description MUST explicitly support every claim limitation (§112(a) written description). For any functional/genus language, provide structural detail or representative species so a POSITA can recognize possession.`,
    maxTokens: 4000,
  });
  return parseJSON(raw, {
    abstract: "",
    field: "",
    background: "",
    summary: "",
    description: "",
  });
}

// ─────────────────────────────────────────────────────────────
// AGENT 5: Examiner Simulator
// ─────────────────────────────────────────────────────────────
interface ExaminerFinding {
  section: "101" | "102" | "103" | "112";
  severity: "high" | "medium" | "low";
  affected_claims: number[];
  issue: string;
  suggested_fix: string;
}

interface ExaminerReport {
  overall_score: number;
  findings: ExaminerFinding[];
  summary: string;
}

async function examinerSimulatorAgent(
  apiKey: string,
  claims: ClaimNode[],
  spec: { abstract: string; description: string },
  priorArtSummary: string,
): Promise<ExaminerReport> {
  const claimsText = claims.map((c) => c.full_text).join("\n\n");
  const raw = await callAI({
    apiKey,
    model: MODEL_PRO,
    jsonMode: true,
    system:
      "You are a USPTO patent examiner conducting a first-office-action review. Apply MPEP standards rigorously. Score the application 0-100 where 100 = ready to allow, 0 = certain rejection. Be specific and actionable.",
    user: `CLAIMS:\n${claimsText}\n\nABSTRACT:\n${spec.abstract}\n\nSPECIFICATION EXCERPT:\n${spec.description.slice(0, 3000)}\n\nRELEVANT PRIOR ART:\n${priorArtSummary.slice(0, 2000)}\n\nEvaluate under:\n- §101 (patent eligibility, Alice/Mayo)\n- §102 (novelty vs. prior art)\n- §103 (obviousness, KSR)\n- §112 (written description, enablement, definiteness)\n\nReturn ONLY valid JSON (no markdown):\n{\n  "overall_score": 85,\n  "summary": "One paragraph overall assessment",\n  "findings": [\n    {\n      "section": "103",\n      "severity": "high",\n      "affected_claims": [1, 3],\n      "issue": "Specific issue description",\n      "suggested_fix": "Concrete rewrite suggestion"\n    }\n  ]\n}`,
    maxTokens: 2500,
  });
  return parseJSON<ExaminerReport>(raw, {
    overall_score: 70,
    findings: [],
    summary: "Examiner simulation could not complete; manual review recommended.",
  });
}

// ─────────────────────────────────────────────────────────────
// AGENT 6: Revision Agent
// ─────────────────────────────────────────────────────────────
async function revisionAgent(
  apiKey: string,
  claims: ClaimNode[],
  examinerReport: ExaminerReport,
  brief: string,
): Promise<ClaimNode[]> {
  const claimsText = claims.map((c) => c.full_text).join("\n\n");
  const findingsText = examinerReport.findings
    .filter((f) => f.severity === "high" || f.severity === "medium")
    .map((f) => `§${f.section} (${f.severity}) - Claims ${f.affected_claims.join(", ")}: ${f.issue}\nFIX: ${f.suggested_fix}`)
    .join("\n\n");

  if (!findingsText) return claims;

  const raw = await callAI({
    apiKey,
    model: MODEL_PRO,
    jsonMode: true,
    system:
      "You are a patent attorney revising claims in response to examiner findings. Preserve the claim numbering and structure. Rewrite only the affected claims to overcome the specific rejections while keeping scope as broad as reasonable.",
    user: `TECHNICAL BRIEF:\n${brief}\n\nCURRENT CLAIMS:\n${claimsText}\n\nEXAMINER FINDINGS TO ADDRESS:\n${findingsText}\n\nReturn ONLY valid JSON with the full revised claim tree in the same shape as input:\n{\n  "claims": [\n    {\n      "claim_number": 1,\n      "claim_type": "independent",\n      "parent_claim": null,\n      "elements": ["..."],\n      "full_text": "1. A ...",\n      "rationale": "How this revision overcomes finding X"\n    }\n  ]\n}`,
    maxTokens: 3000,
  });
  const parsed = parseJSON<{ claims: ClaimNode[] }>(raw, { claims });
  return parsed.claims?.length ? parsed.claims : claims;
}

// ─────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) return jsonResponse({ error: "LOVABLE_API_KEY not configured" }, 500);

    const supabaseAuth = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub;

    const body = await req.json().catch(() => ({}));
    const sessionId = body?.session_id;
    if (!sessionId) return jsonResponse({ error: "session_id required" }, 400);

    const supabase = createClient(supabaseUrl, supabaseService);

    // Verify session ownership
    const { data: session, error: sessErr } = await supabase
      .from("patent_sessions")
      .select("id, user_id, idea_prompt")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessErr || !session) return jsonResponse({ error: "Session not found" }, 404);
    if (session.user_id !== userId) return jsonResponse({ error: "Forbidden" }, 403);

    // Load context
    const [{ data: qa }, { data: priorArt }] = await Promise.all([
      supabase.from("ai_questions").select("question, answer").eq("session_id", sessionId).not("answer", "is", null),
      supabase
        .from("prior_art_results")
        .select("title, summary, similarity_score, overlap_claims, difference_claims")
        .eq("session_id", sessionId)
        .order("similarity_score", { ascending: false })
        .limit(5),
    ]);

    const steps: Array<{ agent: string; status: string; duration_ms: number }> = [];
    const startTime = Date.now();

    // Step 1: Interview
    let t0 = Date.now();
    const brief = await interviewAgent(lovableApiKey, session.idea_prompt, qa ?? []);
    steps.push({ agent: "interview", status: "complete", duration_ms: Date.now() - t0 });

    // Step 2: Differentiation
    t0 = Date.now();
    const differentiation = await differentiationAgent(lovableApiKey, brief, priorArt ?? []);
    steps.push({ agent: "differentiation", status: "complete", duration_ms: Date.now() - t0 });

    // Step 3: Claim Architect
    t0 = Date.now();
    let claims = await claimArchitectAgent(lovableApiKey, brief, differentiation);
    steps.push({ agent: "claim_architect", status: "complete", duration_ms: Date.now() - t0 });
    if (claims.length === 0) throw new Error("Claim Architect produced no claims.");

    // Step 4: Spec Writer
    t0 = Date.now();
    const spec = await specWriterAgent(lovableApiKey, brief, claims);
    steps.push({ agent: "spec_writer", status: "complete", duration_ms: Date.now() - t0 });

    // Step 5-6: Examiner + Revision loop (max 2 revisions)
    let examinerReport: ExaminerReport = { overall_score: 0, findings: [], summary: "" };
    let revisionCycles = 0;
    for (let i = 0; i < 3; i++) {
      t0 = Date.now();
      examinerReport = await examinerSimulatorAgent(lovableApiKey, claims, spec, differentiation);
      steps.push({ agent: `examiner_pass_${i + 1}`, status: "complete", duration_ms: Date.now() - t0 });

      if (examinerReport.overall_score >= 85 || revisionCycles >= 2) break;

      t0 = Date.now();
      claims = await revisionAgent(lovableApiKey, claims, examinerReport, brief);
      steps.push({ agent: `revision_pass_${revisionCycles + 1}`, status: "complete", duration_ms: Date.now() - t0 });
      revisionCycles++;
    }

    // Persist
    // 1. Clear existing claim tree for this session
    await supabase.from("patent_claim_tree").delete().eq("session_id", sessionId);

    // 2. Insert new claim tree
    const claimRows = claims.map((c) => ({
      session_id: sessionId,
      claim_number: c.claim_number,
      claim_type: c.claim_type,
      parent_claim: c.parent_claim,
      elements: c.elements,
      full_text: c.full_text,
      rationale: c.rationale,
      rejection_risk_score: examinerReport.findings.some((f) => f.affected_claims.includes(c.claim_number) && f.severity === "high")
        ? 40
        : examinerReport.overall_score,
    }));
    if (claimRows.length > 0) {
      await supabase.from("patent_claim_tree").insert(claimRows);
    }

    // 3. Upsert patent sections
    const sectionsToUpsert = [
      { section_type: "abstract", content: spec.abstract },
      { section_type: "field", content: spec.field },
      { section_type: "background", content: spec.background },
      { section_type: "summary", content: spec.summary },
      { section_type: "description", content: spec.description },
      { section_type: "claims", content: claims.map((c) => c.full_text).join("\n\n") },
    ].filter((s) => s.content);

    for (const sec of sectionsToUpsert) {
      await supabase.from("patent_sections").upsert(
        {
          session_id: sessionId,
          section_type: sec.section_type,
          content: sec.content,
          is_user_edited: false,
        },
        { onConflict: "session_id,section_type" },
      );
    }

    // 4. Insert reasoning trail
    const reasoningRows = [
      {
        session_id: sessionId,
        target_type: "pipeline" as const,
        target_id: "overview",
        agent_name: "orchestrator",
        rationale: brief,
        examiner_findings: examinerReport as unknown as Record<string, unknown>,
        revision_number: revisionCycles,
      },
      ...claims.map((c) => ({
        session_id: sessionId,
        target_type: "claim" as const,
        target_id: String(c.claim_number),
        agent_name: revisionCycles > 0 ? "revision" : "claim_architect",
        rationale: c.rationale ?? "",
        revision_number: revisionCycles,
      })),
    ];
    await supabase.from("patent_draft_reasoning").insert(reasoningRows);

    return jsonResponse({
      success: true,
      overall_score: examinerReport.overall_score,
      claim_count: claims.length,
      revision_cycles: revisionCycles,
      examiner_report: examinerReport,
      pipeline_steps: steps,
      total_duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    console.error("Pipeline error:", err);
    const message = err instanceof Error ? err.message : "Pipeline failed";
    return jsonResponse({ success: false, error: message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
