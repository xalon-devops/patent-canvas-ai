
CREATE TABLE public.ingest_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL DEFAULT 'mpep_full',
  status text NOT NULL DEFAULT 'pending',
  current_stage text,
  current_chapter text,
  total_urls integer NOT NULL DEFAULT 0,
  scraped_urls integer NOT NULL DEFAULT 0,
  total_chunks integer NOT NULL DEFAULT 0,
  completed_chunks integer NOT NULL DEFAULT 0,
  failed_chunks integer NOT NULL DEFAULT 0,
  error_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ingest_jobs TO authenticated;
GRANT ALL ON public.ingest_jobs TO service_role;

ALTER TABLE public.ingest_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ingest jobs"
  ON public.ingest_jobs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ingest_jobs_updated_at
  BEFORE UPDATE ON public.ingest_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ingest_jobs;
ALTER TABLE public.ingest_jobs REPLICA IDENTITY FULL;
