
CREATE TABLE public.trademark_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trademark_search_id uuid REFERENCES public.trademark_searches(id) ON DELETE CASCADE,
  trademark_application_id uuid REFERENCES public.trademark_applications(id) ON DELETE CASCADE,
  mark_name text NOT NULL,
  search_query text NOT NULL,
  nice_classes text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  results_found integer DEFAULT 0,
  new_results_count integer DEFAULT 0,
  highest_similarity_score numeric,
  last_search_at timestamptz NOT NULL DEFAULT now(),
  next_search_at timestamptz,
  monitoring_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trademark_monitoring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trademark monitoring"
  ON public.trademark_monitoring FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own trademark monitoring"
  ON public.trademark_monitoring FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own trademark monitoring"
  ON public.trademark_monitoring FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own trademark monitoring"
  ON public.trademark_monitoring FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage trademark monitoring"
  ON public.trademark_monitoring FOR ALL TO service_role
  USING (true) WITH CHECK (true);
