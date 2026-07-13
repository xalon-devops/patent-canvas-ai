
-- Structured claim tree
CREATE TABLE public.patent_claim_tree (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.patent_sessions(id) ON DELETE CASCADE,
  claim_number int NOT NULL,
  claim_type text NOT NULL CHECK (claim_type IN ('independent', 'dependent')),
  parent_claim int,
  elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  full_text text NOT NULL,
  rationale text,
  rejection_risk_score int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, claim_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patent_claim_tree TO authenticated;
GRANT ALL ON public.patent_claim_tree TO service_role;

ALTER TABLE public.patent_claim_tree ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claim tree"
ON public.patent_claim_tree FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.patent_sessions ps
  WHERE ps.id = patent_claim_tree.session_id AND ps.user_id = auth.uid()
));

CREATE POLICY "Users can insert own claim tree"
ON public.patent_claim_tree FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.patent_sessions ps
  WHERE ps.id = patent_claim_tree.session_id AND ps.user_id = auth.uid()
));

CREATE POLICY "Users can update own claim tree"
ON public.patent_claim_tree FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.patent_sessions ps
  WHERE ps.id = patent_claim_tree.session_id AND ps.user_id = auth.uid()
));

CREATE POLICY "Users can delete own claim tree"
ON public.patent_claim_tree FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.patent_sessions ps
  WHERE ps.id = patent_claim_tree.session_id AND ps.user_id = auth.uid()
));

CREATE TRIGGER update_patent_claim_tree_updated_at
BEFORE UPDATE ON public.patent_claim_tree
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_patent_claim_tree_session ON public.patent_claim_tree(session_id, claim_number);


-- Agent reasoning trail
CREATE TABLE public.patent_draft_reasoning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.patent_sessions(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('claim', 'section', 'pipeline')),
  target_id text NOT NULL,
  agent_name text NOT NULL,
  rationale text NOT NULL,
  prior_art_references jsonb DEFAULT '[]'::jsonb,
  examiner_findings jsonb DEFAULT '{}'::jsonb,
  revision_number int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.patent_draft_reasoning TO authenticated;
GRANT ALL ON public.patent_draft_reasoning TO service_role;

ALTER TABLE public.patent_draft_reasoning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reasoning"
ON public.patent_draft_reasoning FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.patent_sessions ps
  WHERE ps.id = patent_draft_reasoning.session_id AND ps.user_id = auth.uid()
));

CREATE POLICY "Users can insert own reasoning"
ON public.patent_draft_reasoning FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.patent_sessions ps
  WHERE ps.id = patent_draft_reasoning.session_id AND ps.user_id = auth.uid()
));

CREATE INDEX idx_patent_draft_reasoning_session ON public.patent_draft_reasoning(session_id, target_type, target_id);
