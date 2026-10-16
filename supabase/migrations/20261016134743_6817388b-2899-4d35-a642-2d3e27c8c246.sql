ALTER TABLE public.prior_art_searches ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.trademark_searches ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.patent_sessions ADD COLUMN IF NOT EXISTS title text;
GRANT UPDATE ON public.trademark_searches TO authenticated;
CREATE POLICY "Users can update their own trademark searches"
  ON public.trademark_searches FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);