-- Create trademark applications table
CREATE TABLE public.trademark_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mark_name text NOT NULL,
  mark_type text NOT NULL DEFAULT 'wordmark',
  mark_description text,
  filing_basis text NOT NULL DEFAULT 'intent_to_use',
  first_use_date date,
  first_use_commerce_date date,
  nice_classes text[] DEFAULT '{}',
  goods_services jsonb DEFAULT '[]'::jsonb,
  owner_name text,
  owner_type text DEFAULT 'individual',
  owner_address jsonb DEFAULT '{}'::jsonb,
  specimen_description text,
  specimen_file_path text,
  ai_analysis jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'draft',
  step_completed integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trademark_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own trademark applications"
  ON public.trademark_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own trademark applications"
  ON public.trademark_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own trademark applications"
  ON public.trademark_applications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own trademark applications"
  ON public.trademark_applications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all trademark applications"
  ON public.trademark_applications FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage trademark applications"
  ON public.trademark_applications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_trademark_applications_updated_at
  BEFORE UPDATE ON public.trademark_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();