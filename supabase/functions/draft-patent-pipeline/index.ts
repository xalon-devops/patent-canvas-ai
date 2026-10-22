// Multi-Agent Patent Drafting Pipeline
// Orchestrates 6 specialized agents to produce examiner-tested patent drafts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { retrieveMpep, formatMpepContext } from "../_shared/mpep-rag.ts";
import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  requireSessionAccess, requirePaidAccess, fetchWithTimeout, aiGatewayError,
  parseModelJson, saveSection, markDraftComplete, type PatentSectionType,
} from "../_shared/http.ts";

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

  const res = await fetchWithTimeout(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, 90_000);

  if (!res.ok) throw await aiGatewayError(res, "draft-pipeline");

  const data = await res.json().catch(() => null);
  return data?.choices?.[0]?.message?.content ?? "";
}

function parseJSON<T>(raw: string, fallback: T): T {
  const parsed = parseModelJson<T>(raw);
  return parsed && typeof parsed === "object" ? parsed : fallback;
}

// Normalize model output so DB constraints (claim_type CHECK, UNIQUE(session_id, claim_number),
// NOT NULL full_text, int columns) never reject the insert.
function sanitizeClaims(input: unknown): ClaimNode[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<number>();
  const out: ClaimNode[] = [];
  for (const c of input as any[]) {
    const n = Math.round(Number(c?.claim_number));
    const text = typeof c?.full_text === "string" ? c.full_text.trim() : "";
    if (!Number.isFinite(n) || n < 1 || seen.has(n) || !text) continue;
    seen.add(n);
    const parentNum = c?.parent_claim == null ? null : Math.round(Number(c.parent_claim));
    const parent = parentNum != null && Number.isFinite(parentNum) && parentNum >= 1 && parentNum !== n ? parentNum : null;
    const type = c?.claim_type === "dependent" && parent != null ? "dependent" : "independent";
    out.push({
      claim_number: n,
      claim_type: type,
      parent_claim: type === "dependent" ? parent : null,
      elements: Array.isArray(c?.elements) ? c.elements.filter((e: unknown) => typeof e === "string") : [],
      full_text: text,
      rationale: typeof c?.rationale === "string" ? c.rationale : "",
    });
  }
  return out.sort((a, b) => a.claim_number - b.claim_number);
}

function sanitizeExaminerReport(r: any, fallbackScore = 70): ExaminerReport {
  const score = Number(r?.overall_score);
  return {
    overall_score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : fallbackScore,
    summary: typeof r?.summary === "string" ? r.summary : "",
    findings: Array.isArray(r?.findings)
      ? r.findings.map((f: any) => ({
          section: String(f?.section ?? "").replace(/[^0-9]/g, "").slice(0, 3) as ExaminerFinding["section"],
          severity: (["high", "medium", "low"].includes(f?.severity) ? f.severity : "low") as ExaminerFinding["severity"],
          affected_claims: Array.isArray(f?.affected_claims)
            ? f.affected_claims.map((x: unknown) => Math.round(Number(x))).filter((x: number) => Number.isFinite(x))
            : [],
          issue: String(f?.issue ?? ""),
          suggested_fix: String(f?.suggested_fix ?? ""),
        }))
      : [],
  };
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
  return sanitizeClaims(parsed.claims);
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
  const spec = parseJSON<Record<string, unknown>>(raw, {});
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    abstract: str(spec.abstract),
    field: str(spec.field),
    background: str(spec.background),
    summary: str(spec.summary),
    description: str(spec.description),
  };
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
  supabase: SupabaseClient,
  claims: ClaimNode[],
  spec: { abstract: string; description: string },
  priorArtSummary: string,
): Promise<ExaminerReport> {
  const claimsText = claims.map((c) => c.full_text).join("\n\n");

  // Retrieve MPEP passages for each statutory section in parallel
  const [ch101, ch102, ch103, ch112] = await Promise.all([
    retrieveMpep(apiKey, supabase, `§101 patent eligibility Alice Mayo abstract idea judicial exception ${claimsText.slice(0, 400)}`, { k: 2, sectionFilter: "2106" }),
    retrieveMpep(apiKey, supabase, `§102 anticipation novelty prior art single reference ${priorArtSummary.slice(0, 400)}`, { k: 2, sectionFilter: "213" }),
    retrieveMpep(apiKey, supabase, `§103 obviousness KSR Graham factors motivation to combine ${priorArtSummary.slice(0, 400)}`, { k: 2, sectionFilter: "214" }),
    retrieveMpep(apiKey, supabase, `§112 written description enablement definiteness Nautilus means-plus-function ${claimsText.slice(0, 400)}`, { k: 3, sectionFilter: "21" }),
  ]);
  const mpepContext = formatMpepContext([...ch101, ...ch102, ...ch103, ...ch112]);

  const raw = await callAI({
    apiKey,
    model: MODEL_PRO,
    jsonMode: true,
    system:
      "You are a USPTO patent examiner conducting a first-office-action review. Apply MPEP standards rigorously — cite the MPEP passages and case law provided verbatim in your findings. Score the application 0-100 where 100 = ready to allow, 0 = certain rejection. Be specific and actionable. Every finding MUST reference a specific MPEP section or precedent from the provided guidance.",
    user: `AUTHORITATIVE MPEP GUIDANCE (base every finding on these passages — cite section numbers and case names):\n${mpepContext}\n\n─────────────\n\nCLAIMS:\n${claimsText}\n\nABSTRACT:\n${spec.abstract}\n\nSPECIFICATION EXCERPT:\n${spec.description.slice(0, 3000)}\n\nRELEVANT PRIOR ART:\n${priorArtSummary.slice(0, 2000)}\n\nEvaluate under:\n- §101 (patent eligibility, Alice/Mayo two-step)\n- §102 (novelty vs. prior art — every element, arranged as claimed)\n- §103 (obviousness, KSR seven rationales, Graham factors)\n- §112(a) (written description, enablement — Wands factors)\n- §112(b) (definiteness — Nautilus reasonable certainty)\n\nReturn ONLY valid JSON (no markdown):\n{\n  "overall_score": 85,\n  "summary": "One paragraph overall assessment citing MPEP sections",\n  "findings": [\n    {\n      "section": "103",\n      "severity": "high",\n      "affected_claims": [1, 3],\n      "issue": "Specific issue with MPEP citation (e.g., 'Under MPEP §2143 rationale A (KSR), combining X from Ref1 with Y from Ref2 yields the predictable result of ...')",\n      "suggested_fix": "Concrete rewrite that addresses the cited MPEP standard"\n    }\n  ]\n}`,
    maxTokens: 2500,
  });
  const parsed = parseModelJson(raw);
  if (!parsed) {
    return { overall_score: 70, findings: [], summary: "Examiner simulation could not complete; manual review recommended." };
  }
  return sanitizeExaminerReport(parsed);
}

// ─────────────────────────────────────────────────────────────
// AGENT 6: Revision Agent
// ─────────────────────────────────────────────────────────────
async function revisionAgent(
  apiKey: string,
  supabase: SupabaseClient,
  claims: ClaimNode[],
  examinerReport: ExaminerReport,
  brief: string,
): Promise<ClaimNode[]> {
  const claimsText = claims.map((c) => c.full_text).join("\n\n");
  const highMedFindings = examinerReport.findings.filter((f) => f.severity === "high" || f.severity === "medium");
  const findingsText = highMedFindings
    .map((f) => `§${f.section} (${f.severity}) - Claims ${f.affected_claims.join(", ")}: ${f.issue}\nFIX: ${f.suggested_fix}`)
    .join("\n\n");

  if (!findingsText) return claims;

  // Retrieve MPEP guidance targeted to the specific sections being addressed
  const uniqueSections = Array.from(new Set(highMedFindings.map((f) => f.section)));
  const mpepChunkArrays = await Promise.all(
    uniqueSections.map((sec) => {
      const filter = sec === "101" ? "2106" : sec === "102" ? "213" : sec === "103" ? "214" : "21";
      const query = `§${sec} ${highMedFindings.filter((f) => f.section === sec).map((f) => f.issue).join(" ")}`;
      return retrieveMpep(apiKey, supabase, query.slice(0, 800), { k: 2, sectionFilter: filter });
    }),
  );
  const mpepContext = formatMpepContext(mpepChunkArrays.flat());

  const raw = await callAI({
    apiKey,
    model: MODEL_PRO,
    jsonMode: true,
    system:
      "You are a patent attorney revising claims in response to examiner findings. Preserve the claim numbering and structure. Rewrite only the affected claims to overcome the specific rejections while keeping scope as broad as reasonable. Ground each revision in the provided MPEP guidance.",
    user: `${mpepContext ? `AUTHORITATIVE MPEP GUIDANCE FOR THESE REJECTIONS:\n${mpepContext}\n\n─────────────\n\n` : ""}TECHNICAL BRIEF:\n${brief}\n\nCURRENT CLAIMS:\n${claimsText}\n\nEXAMINER FINDINGS TO ADDRESS:\n${findingsText}\n\nReturn ONLY valid JSON with the full revised claim tree in the same shape as input:\n{\n  "claims": [\n    {\n      "claim_number": 1,\n      "claim_type": "independent",\n      "parent_claim": null,\n      "elements": ["..."],\n      "full_text": "1. A ...",\n      "rationale": "How this revision overcomes finding X — cite the specific MPEP section relied upon"\n    }\n  ]\n}`,
    maxTokens: 3000,
  });
  const parsed = parseJSON<{ claims: ClaimNode[] }>(raw, { claims });
  const revised = sanitizeClaims(parsed.claims);
  return revised.length ? revised : claims;
}

// ─────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────
serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const caller = await authenticate(req);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new HttpError(500, "AI service is not configured.");

    const body = await readJson<{ session_id?: string }>(req, 64_000);

    // Ownership (owner/admin/service) then paid entitlement for the full multi-agent pipeline
    const session = await requireSessionAccess(caller, body.session_id, "id, user_id, idea_prompt, status");
    const sessionId: string = session.id;
    await requirePaidAccess(caller);
    const supabase = caller.admin;
    if (!session.idea_prompt || !String(session.idea_prompt).trim()) {
      throw new HttpError(409, "Describe your invention before running the drafting pipeline.");
    }

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
    const brief = await interviewAgent(lovableApiKey, String(session.idea_prompt).slice(0, 20000), qa ?? []);
    steps.push({ agent: "interview", status: "complete", duration_ms: Date.now() - t0 });

    // Step 2: Differentiation
    t0 = Date.now();
    const differentiation = await differentiationAgent(lovableApiKey, brief, priorArt ?? []);
    steps.push({ agent: "differentiation", status: "complete", duration_ms: Date.now() - t0 });

    // Step 3: Claim Architect (grounded in MPEP claim-form & definiteness)
    t0 = Date.now();
    let claims = await claimArchitectAgent(lovableApiKey, supabase, brief, differentiation);
    steps.push({ agent: "claim_architect", status: "complete", duration_ms: Date.now() - t0 });
    if (claims.length === 0) throw new HttpError(502, "The claim drafting agent did not return usable claims. Please try again.");

    // Step 4: Spec Writer (grounded in MPEP §112(a))
    t0 = Date.now();
    const spec = await specWriterAgent(lovableApiKey, supabase, brief, claims);
    steps.push({ agent: "spec_writer", status: "complete", duration_ms: Date.now() - t0 });

    // Step 5-6: Examiner (RAG-grounded per §) + Revision loop (max 2 revisions)
    let examinerReport: ExaminerReport = { overall_score: 0, findings: [], summary: "" };
    let revisionCycles = 0;
    for (let i = 0; i < 3; i++) {
      t0 = Date.now();
      examinerReport = await examinerSimulatorAgent(lovableApiKey, supabase, claims, spec, differentiation);
      steps.push({ agent: `examiner_pass_${i + 1}`, status: "complete", duration_ms: Date.now() - t0 });

      if (examinerReport.overall_score >= 85 || revisionCycles >= 2) break;

      t0 = Date.now();
      claims = await revisionAgent(lovableApiKey, supabase, claims, examinerReport, brief);
      steps.push({ agent: `revision_pass_${revisionCycles + 1}`, status: "complete", duration_ms: Date.now() - t0 });
      revisionCycles++;
    }

    // Persist
    // 1. Patent sections first (most important output). patent_sections has no
    //    UNIQUE(session_id, section_type), so upsert(onConflict) would fail — use saveSection.
    const sectionsToSave: Array<{ section_type: PatentSectionType; content: string }> = [
      { section_type: "abstract", content: spec.abstract },
      { section_type: "field", content: spec.field },
      { section_type: "background", content: spec.background },
      { section_type: "summary", content: spec.summary },
      { section_type: "description", content: spec.description },
      { section_type: "claims", content: claims.map((c) => c.full_text).join("\n\n") },
    ];
    for (const sec of sectionsToSave.filter((s) => s.content && s.content.trim())) {
      await saveSection(supabase, sessionId, sec.section_type, sec.content);
    }

    // 2. Replace claim tree
    const { error: delErr } = await supabase.from("patent_claim_tree").delete().eq("session_id", sessionId);
    if (delErr) throw new Error(`claim tree delete: ${delErr.message}`);
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
        : Math.round(examinerReport.overall_score),
    }));
    if (claimRows.length > 0) {
      const { error: insErr } = await supabase.from("patent_claim_tree").insert(claimRows);
      if (insErr) throw new Error(`claim tree insert: ${insErr.message}`);
    }

    // 3. Reasoning trail (non-fatal)
    const reasoningRows = [
      {
        session_id: sessionId,
        target_type: "pipeline" as const,
        target_id: "overview",
        agent_name: "orchestrator",
        rationale: brief || "Pipeline run",
        examiner_findings: examinerReport as unknown as Record<string, unknown>,
        revision_number: revisionCycles,
      },
      ...claims.map((c) => ({
        session_id: sessionId,
        target_type: "claim" as const,
        target_id: String(c.claim_number),
        agent_name: revisionCycles > 0 ? "revision" : "claim_architect",
        rationale: c.rationale || "",
        revision_number: revisionCycles,
      })),
    ];
    const { error: reasonErr } = await supabase.from("patent_draft_reasoning").insert(reasoningRows);
    if (reasonErr) console.warn("patent_draft_reasoning insert failed:", reasonErr.message);

    // 4. Draft complete: status transition + one-time 'draft_complete' email
    await supabase.from("patent_sessions").update({ ai_analysis_complete: true }).eq("id", sessionId);
    await markDraftComplete(supabase, sessionId, session.user_id);

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
    return errorResponse(err, "The drafting pipeline failed. Please try again.", "draft-patent-pipeline");
  }
});
