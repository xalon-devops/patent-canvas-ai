-- Close the public upload hole on the "patents" bucket.
DROP POLICY IF EXISTS "System can upload patent files" ON storage.objects;

CREATE POLICY "Only backend can upload patent files"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'patents');

-- Persist filing-checklist manual checks per patent session
CREATE TABLE public.patent_checklist_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.patent_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  checked_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patent_checklist_state TO authenticated;
GRANT ALL ON public.patent_checklist_state TO service_role;
ALTER TABLE public.patent_checklist_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own checklist state"
ON public.patent_checklist_state FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_patent_checklist_state_updated_at
BEFORE UPDATE ON public.patent_checklist_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Standalone prior-art searches (Check & See history)
CREATE TABLE public.prior_art_searches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  query text NOT NULL,
  patent_type text,
  results_count integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prior_art_searches TO authenticated;
GRANT ALL ON public.prior_art_searches TO service_role;
ALTER TABLE public.prior_art_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own prior art searches"
ON public.prior_art_searches FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_prior_art_searches_user_created
ON public.prior_art_searches (user_id, created_at DESC);

-- Allow deleting prior-art monitors (previously no delete policy existed)
DROP POLICY IF EXISTS "Users can delete their prior art monitoring" ON public.prior_art_monitoring;
CREATE POLICY "Users can delete their prior art monitoring"
ON public.prior_art_monitoring FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.patent_sessions s WHERE s.id = prior_art_monitoring.patent_session_id AND s.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.patent_ideas i WHERE i.id = prior_art_monitoring.patent_idea_id AND i.user_id = auth.uid())
);

-- Allow users to insert prior-art monitors directly from the dashboard
DROP POLICY IF EXISTS "Users can create their prior art monitoring" ON public.prior_art_monitoring;
CREATE POLICY "Users can create their prior art monitoring"
ON public.prior_art_monitoring FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.patent_sessions s WHERE s.id = prior_art_monitoring.patent_session_id AND s.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.patent_ideas i WHERE i.id = prior_art_monitoring.patent_idea_id AND i.user_id = auth.uid())
);

-- Let users delete their own trademark search history
DROP POLICY IF EXISTS "Users can delete their own trademark searches" ON public.trademark_searches;
CREATE POLICY "Users can delete their own trademark searches"
ON public.trademark_searches FOR DELETE TO authenticated
USING (auth.uid() = user_id);