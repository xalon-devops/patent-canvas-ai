
-- Trademark search sessions
CREATE TABLE public.trademark_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mark_name text NOT NULL,
  mark_description text,
  nice_classes text[] DEFAULT '{}',
  search_type text DEFAULT 'wordmark',
  status text DEFAULT 'completed',
  results_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trademark_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trademark searches"
  ON public.trademark_searches FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own trademark searches"
  ON public.trademark_searches FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own trademark searches"
  ON public.trademark_searches FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all trademark searches"
  ON public.trademark_searches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trademark search results
CREATE TABLE public.trademark_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id uuid NOT NULL REFERENCES public.trademark_searches(id) ON DELETE CASCADE,
  mark_name text,
  registration_number text,
  serial_number text,
  status text,
  owner text,
  filing_date date,
  registration_date date,
  nice_classes text[] DEFAULT '{}',
  goods_services text,
  similarity_score double precision DEFAULT 0,
  conflict_analysis text[] DEFAULT '{}',
  differentiation_points text[] DEFAULT '{}',
  source text DEFAULT 'USPTO',
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trademark_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trademark results for their searches"
  ON public.trademark_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trademark_searches
    WHERE trademark_searches.id = trademark_results.search_id
    AND trademark_searches.user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage trademark results"
  ON public.trademark_results FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can insert trademark results for their searches"
  ON public.trademark_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.trademark_searches
    WHERE trademark_searches.id = trademark_results.search_id
    AND trademark_searches.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete trademark results for their searches"
  ON public.trademark_results FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trademark_searches
    WHERE trademark_searches.id = trademark_results.search_id
    AND trademark_searches.user_id = auth.uid()
  ));
