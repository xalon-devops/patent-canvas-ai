# Multi-Agent Patent Drafting Pipeline

Transform the current single-shot drafting into an orchestrated flow of specialized agents that produce claims capable of surviving USPTO examination.

## What Changes

Today: user answers Q&A → one AI call generates all sections → user edits text.

New: user answers Q&A → orchestrator runs 6 specialized agents in sequence → each agent has its own model, prompt, and quality gate → final draft is examiner-tested and auto-revised → user sees reasoning behind every claim.

## The Pipeline

```text
┌─────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR (new edge function: draft-patent-pipeline)   │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
  [1] Inventor Interview Agent      (gemini-2.5-flash)
      → Enriches Q&A context, identifies gaps
        │
        ▼
  [2] Prior Art Differentiation     (gemini-2.5-pro)
      → Pulls existing prior_art_results
      → Identifies what MUST be novel
        │
        ▼
  [3] Claim Architect Agent         (gemini-2.5-pro)
      → Structured claim tree (independent + dependents)
      → Returns JSON: { claims: [{ id, type, parent, elements, rationale }] }
        │
        ▼
  [4] Specification Writer Agent    (gemini-2.5-pro)
      → Abstract, Background, Summary, Detailed Description
      → Grounded in claim tree
        │
        ▼
  [5] Examiner Simulator Agent      (gemini-2.5-pro)
      → §101 (Alice), §102 (novelty), §103 (obviousness), §112 (enablement)
      → Returns rejection_score (0-100) + specific issues per claim
        │
        ▼
  [6] Revision Agent                (gemini-2.5-pro)  [only if score < 85]
      → Rewrites problem claims/sections based on examiner feedback
      → Loops back to step 5 (max 2 revision cycles)
        │
        ▼
  Persist to patent_sections + new patent_draft_reasoning table
```

## Files to Create

**Edge functions:**
- `supabase/functions/draft-patent-pipeline/index.ts` — orchestrator
- `supabase/functions/_shared/agents/interview-agent.ts`
- `supabase/functions/_shared/agents/differentiation-agent.ts`
- `supabase/functions/_shared/agents/claim-architect.ts`
- `supabase/functions/_shared/agents/spec-writer.ts`
- `supabase/functions/_shared/agents/examiner-simulator.ts`
- `supabase/functions/_shared/agents/revision-agent.ts`
- `supabase/functions/_shared/ai-gateway.ts` — shared Lovable AI helper

**Frontend:**
- `src/components/DraftingPipelineProgress.tsx` — live step-by-step progress UI
- `src/components/ClaimTreeView.tsx` — visual claim dependency tree with rationale tooltips
- `src/components/ExaminerReport.tsx` — shows §101/102/103/112 findings
- Update `src/components/PatentCanvas.tsx` to consume the new structured output

## Database Changes

New migration:

```sql
-- Stores AI reasoning for each claim/section (transparency layer)
CREATE TABLE public.patent_draft_reasoning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.patent_sessions(id) ON DELETE CASCADE,
  target_type text NOT NULL,        -- 'claim' | 'section'
  target_id text NOT NULL,          -- claim number or section_type
  agent_name text NOT NULL,         -- which agent produced this
  rationale text NOT NULL,
  prior_art_references jsonb,
  examiner_findings jsonb,
  revision_number int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Stores structured claim tree (parallel to patent_sections)
CREATE TABLE public.patent_claim_tree (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.patent_sessions(id) ON DELETE CASCADE,
  claim_number int NOT NULL,
  claim_type text NOT NULL,          -- 'independent' | 'dependent'
  parent_claim int,
  elements jsonb NOT NULL,           -- array of claim elements
  full_text text NOT NULL,
  rejection_risk_score int,          -- 0-100 from examiner sim
  UNIQUE(session_id, claim_number)
);

-- GRANTs + RLS scoped to session owner
```

## Model Routing

| Agent | Model | Reasoning |
|---|---|---|
| Interview | `google/gemini-2.5-flash` | Fast conversational enrichment |
| Differentiation | `google/gemini-2.5-pro` | Long context (multiple patents) |
| Claim Architect | `google/gemini-2.5-pro` | Precision on legal language |
| Spec Writer | `google/gemini-2.5-pro` | Long-form coherence |
| Examiner Simulator | `google/gemini-2.5-pro` | Legal reasoning |
| Revision | `google/gemini-2.5-pro` | Precision rewrite |

Complies with your "only Gemini 2.5 Pro/Flash" memory rule.

## Backward Compatibility

- Existing `generate-patent-draft-enhanced` stays functional (fallback)
- New pipeline is triggered from a new "Draft with AI Pipeline" button in Patent Canvas
- Old drafts continue to render normally; new drafts get the enhanced canvas
- No breaking changes to `patent_sections` schema

## UX Flow

1. User clicks "Generate Patent Draft" in Patent Canvas
2. `DraftingPipelineProgress` modal shows live agent steps with checkmarks
3. Total time: ~45-90 seconds (was ~20 seconds, but quality jump justifies it)
4. On completion: Patent Canvas renders claim tree + examiner report + spec sections
5. User can hover any claim element to see the AI's rationale
6. User can click "Why this wording?" to see prior art references

## Out of Scope (Future Iterations)

- RAG over MPEP/USPTO (Upgrade #4 from prior discussion) — separate build
- Element-level interactive refinement UI (Upgrade #5) — separate build
- Real-time quality scoring dashboard (Upgrade #6) — separate build

Those three are the natural next builds after this ships.

## Success Criteria

- Pipeline completes end-to-end in under 90s for a typical invention
- Examiner simulator produces actionable findings (not generic advice)
- Claim tree renders correctly with dependency arrows
- User can see rationale for at least every independent claim
- Backward compatible — old sessions still open normally

## Estimated Scope

~1,200 lines across 6 agent files, 1 orchestrator, 3 UI components, 1 migration. All new code; minimal changes to existing files.
