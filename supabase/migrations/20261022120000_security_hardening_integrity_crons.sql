-- =====================================================================
-- Security hardening, data integrity and scheduled jobs (full-app audit)
-- =====================================================================
-- Service-role clients (edge functions, crons) bypass RLS, so none of the
-- "System/Edge functions can ..." USING (true) policies below were needed by
-- the backend. They only opened these tables to every signed-in user:
--   * anyone could grant themselves a premium subscription
--   * anyone could mark any $1,000 application payment as paid
--   * anyone could read every user's Supabase OAuth access/refresh tokens
--   * anyone could reset their own (or others') free search credits

-- ---------------------------------------------------------------------
-- 1. Drop permissive policies
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Edge functions can upsert subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Edge functions can update subscriptions" ON public.subscriptions;

DROP POLICY IF EXISTS "System can insert payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "System can update payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Edge functions can update payment transactions" ON public.payment_transactions;

DROP POLICY IF EXISTS "Edge functions can update application payments" ON public.application_payments;

DROP POLICY IF EXISTS "Edge functions can manage search credits" ON public.user_search_credits;

DROP POLICY IF EXISTS "Edge functions can manage connections" ON public.supabase_connections;

DROP POLICY IF EXISTS "System can manage prior art monitoring" ON public.prior_art_monitoring;

DROP POLICY IF EXISTS "System can insert email notifications" ON public.email_notifications;
DROP POLICY IF EXISTS "System can update email notifications" ON public.email_notifications;

DROP POLICY IF EXISTS "System can insert infringement alerts" ON public.infringement_alerts;

DROP POLICY IF EXISTS "System can insert iterations" ON public.draft_iterations;

-- Schema introspection helper must not be callable by the public
REVOKE EXECUTE ON FUNCTION public.get_database_schema() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.get_database_schema() TO service_role;

-- Credit decrement is a backend-only operation (otherwise any user could burn
-- another user's credits by id)
REVOKE EXECUTE ON FUNCTION public.decrement_search_credit(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.decrement_search_credit(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 2. Owner policies that were missing (actions silently did nothing)
-- ---------------------------------------------------------------------
-- Pause/resume a prior-art monitor
DROP POLICY IF EXISTS "Users can update their prior art monitoring" ON public.prior_art_monitoring;
CREATE POLICY "Users can update their prior art monitoring"
ON public.prior_art_monitoring FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.patent_sessions s WHERE s.id = prior_art_monitoring.patent_session_id AND s.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.patent_ideas i WHERE i.id = prior_art_monitoring.patent_idea_id AND i.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.patent_sessions s WHERE s.id = prior_art_monitoring.patent_session_id AND s.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.patent_ideas i WHERE i.id = prior_art_monitoring.patent_idea_id AND i.user_id = auth.uid())
);

-- Dismiss alerts
DROP POLICY IF EXISTS "Users can delete their alerts" ON public.infringement_alerts;
CREATE POLICY "Users can delete their alerts"
ON public.infringement_alerts FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.patent_sessions s WHERE s.id = infringement_alerts.patent_session_id AND s.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.patent_ideas i WHERE i.id = infringement_alerts.patent_idea_id AND i.user_id = auth.uid())
);

-- Remove / rename attached documents
DROP POLICY IF EXISTS "Users can update documents for their patents" ON public.patent_documents;
CREATE POLICY "Users can update documents for their patents"
ON public.patent_documents FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.patent_sessions s WHERE s.id = patent_documents.patent_session_id AND s.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.patent_ideas i WHERE i.id = patent_documents.patent_idea_id AND i.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can delete documents for their patents" ON public.patent_documents;
CREATE POLICY "Users can delete documents for their patents"
ON public.patent_documents FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.patent_sessions s WHERE s.id = patent_documents.patent_session_id AND s.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.patent_ideas i WHERE i.id = patent_documents.patent_idea_id AND i.user_id = auth.uid())
);

-- Reasoning trail rows are replaced on re-runs
DROP POLICY IF EXISTS "Users can delete own reasoning" ON public.patent_draft_reasoning;
GRANT DELETE ON public.patent_draft_reasoning TO authenticated;
CREATE POLICY "Users can delete own reasoning"
ON public.patent_draft_reasoning FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.patent_sessions ps
  WHERE ps.id = patent_draft_reasoning.session_id AND ps.user_id = auth.uid()
));

-- Users can disconnect a Supabase connection they own (update is_active)
DROP POLICY IF EXISTS "Users can update their own connections" ON public.supabase_connections;
CREATE POLICY "Users can update their own connections"
ON public.supabase_connections FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tokens never need to reach the browser: hide them from client roles entirely.
REVOKE SELECT ON public.supabase_connections FROM anon, authenticated;
GRANT SELECT (id, user_id, organization_id, scopes, connection_metadata, is_active, created_at, updated_at,
              project_ref, project_name, project_region, connection_status, token_expires_at)
  ON public.supabase_connections TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Admin policies (the admin console runs as the signed-in admin)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can manage subscriptions"
ON public.subscriptions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all application payments" ON public.application_payments;
CREATE POLICY "Admins can view all application payments"
ON public.application_payments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update application payments" ON public.application_payments;
CREATE POLICY "Admins can update application payments"
ON public.application_payments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete application payments" ON public.application_payments;
CREATE POLICY "Admins can delete application payments"
ON public.application_payments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage search credits" ON public.user_search_credits;
CREATE POLICY "Admins can manage search credits"
ON public.user_search_credits FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all patent sessions" ON public.patent_sessions;
CREATE POLICY "Admins can view all patent sessions"
ON public.patent_sessions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all patent ideas" ON public.patent_ideas;
CREATE POLICY "Admins can view all patent ideas"
ON public.patent_ideas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all prior art searches" ON public.prior_art_searches;
CREATE POLICY "Admins can view all prior art searches"
ON public.prior_art_searches FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all email notifications" ON public.email_notifications;
CREATE POLICY "Admins can view all email notifications"
ON public.email_notifications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------
-- 4. Storage
-- ---------------------------------------------------------------------
-- Nothing reads the legacy 'patents' bucket via public URLs any more; generated
-- filings live in private 'patent-docs' and are served with signed URLs.
UPDATE storage.buckets SET public = false WHERE id = 'patents';

-- Bound what can be stored in patent-docs (uploads + generated bundles)
UPDATE storage.buckets
SET file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'text/markdown', 'text/html', 'text/csv', 'application/json',
      'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'
    ]
WHERE id = 'patent-docs';

-- ---------------------------------------------------------------------
-- 5. Data integrity
-- ---------------------------------------------------------------------
-- draft-patent-pipeline / enhance-patent-section upsert ON CONFLICT (session_id, section_type),
-- which errors without a matching unique constraint. Dedupe (keep user-edited, then newest) first.
DELETE FROM public.patent_sections p
USING (
  SELECT id, row_number() OVER (
    PARTITION BY session_id, section_type
    ORDER BY COALESCE(is_user_edited, false) DESC, created_at DESC NULLS LAST, id DESC
  ) AS rn
  FROM public.patent_sections
  WHERE section_type IS NOT NULL
) d
WHERE p.id = d.id AND d.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patent_sections_session_section_unique'
  ) THEN
    ALTER TABLE public.patent_sections
      ADD CONSTRAINT patent_sections_session_section_unique UNIQUE (session_id, section_type);
  END IF;
END $$;

-- "Last edited" ordering for drafts
ALTER TABLE public.patent_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.patent_sections ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
UPDATE public.patent_sessions SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL;
UPDATE public.patent_sections SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS update_patent_sessions_updated_at ON public.patent_sessions;
CREATE TRIGGER update_patent_sessions_updated_at
  BEFORE UPDATE ON public.patent_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_patent_sections_updated_at ON public.patent_sections;
CREATE TRIGGER update_patent_sections_updated_at
  BEFORE UPDATE ON public.patent_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Touch the parent session whenever one of its sections changes
CREATE OR REPLACE FUNCTION public.touch_patent_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patent_sessions SET updated_at = now()
  WHERE id = COALESCE(NEW.session_id, OLD.session_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS touch_session_on_section_change ON public.patent_sections;
CREATE TRIGGER touch_session_on_section_change
  AFTER INSERT OR UPDATE OR DELETE ON public.patent_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_patent_session();

-- Orphan cleanup + FKs for tables that referenced sessions/ideas without constraints
DELETE FROM public.infringement_alerts a
WHERE (a.patent_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.patent_sessions s WHERE s.id = a.patent_session_id))
   OR (a.patent_idea_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.patent_ideas i WHERE i.id = a.patent_idea_id));
DELETE FROM public.prior_art_monitoring m
WHERE (m.patent_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.patent_sessions s WHERE s.id = m.patent_session_id))
   OR (m.patent_idea_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.patent_ideas i WHERE i.id = m.patent_idea_id));
DELETE FROM public.patent_documents d
WHERE (d.patent_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.patent_sessions s WHERE s.id = d.patent_session_id))
   OR (d.patent_idea_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.patent_ideas i WHERE i.id = d.patent_idea_id));
UPDATE public.payment_transactions t SET application_id = NULL
WHERE t.application_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.patent_sessions s WHERE s.id = t.application_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infringement_alerts_session_fk') THEN
    ALTER TABLE public.infringement_alerts ADD CONSTRAINT infringement_alerts_session_fk
      FOREIGN KEY (patent_session_id) REFERENCES public.patent_sessions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infringement_alerts_idea_fk') THEN
    ALTER TABLE public.infringement_alerts ADD CONSTRAINT infringement_alerts_idea_fk
      FOREIGN KEY (patent_idea_id) REFERENCES public.patent_ideas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prior_art_monitoring_session_fk') THEN
    ALTER TABLE public.prior_art_monitoring ADD CONSTRAINT prior_art_monitoring_session_fk
      FOREIGN KEY (patent_session_id) REFERENCES public.patent_sessions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prior_art_monitoring_idea_fk') THEN
    ALTER TABLE public.prior_art_monitoring ADD CONSTRAINT prior_art_monitoring_idea_fk
      FOREIGN KEY (patent_idea_id) REFERENCES public.patent_ideas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patent_documents_session_fk') THEN
    ALTER TABLE public.patent_documents ADD CONSTRAINT patent_documents_session_fk
      FOREIGN KEY (patent_session_id) REFERENCES public.patent_sessions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patent_documents_idea_fk') THEN
    ALTER TABLE public.patent_documents ADD CONSTRAINT patent_documents_idea_fk
      FOREIGN KEY (patent_idea_id) REFERENCES public.patent_ideas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_transactions_application_fk') THEN
    ALTER TABLE public.payment_transactions ADD CONSTRAINT payment_transactions_application_fk
      FOREIGN KEY (application_id) REFERENCES public.patent_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Every user gets a free-search credit row at signup (clients can no longer insert it)
CREATE OR REPLACE FUNCTION public.handle_new_user_search_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_search_credits (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_search_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_search_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_search_credits();

INSERT INTO public.user_search_credits (user_id)
SELECT au.id FROM auth.users au
LEFT JOIN public.user_search_credits c ON c.user_id = au.id
WHERE c.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6. Indexes for the per-user list queries every page runs
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_patent_sessions_user_created ON public.patent_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patent_sections_session ON public.patent_sections (session_id);
CREATE INDEX IF NOT EXISTS idx_ai_questions_session ON public.ai_questions (session_id);
CREATE INDEX IF NOT EXISTS idx_prior_art_results_session ON public.prior_art_results (session_id);
CREATE INDEX IF NOT EXISTS idx_patent_ideas_user_created ON public.patent_ideas (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_infringement_alerts_session ON public.infringement_alerts (patent_session_id);
CREATE INDEX IF NOT EXISTS idx_infringement_alerts_idea ON public.infringement_alerts (patent_idea_id);
CREATE INDEX IF NOT EXISTS idx_prior_art_monitoring_session ON public.prior_art_monitoring (patent_session_id);
CREATE INDEX IF NOT EXISTS idx_prior_art_monitoring_idea ON public.prior_art_monitoring (patent_idea_id);
CREATE INDEX IF NOT EXISTS idx_prior_art_monitoring_due ON public.prior_art_monitoring (next_search_at) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_patent_documents_session ON public.patent_documents (patent_session_id);
CREATE INDEX IF NOT EXISTS idx_patent_documents_idea ON public.patent_documents (patent_idea_id);
CREATE INDEX IF NOT EXISTS idx_draft_iterations_session ON public.draft_iterations (session_id);
CREATE INDEX IF NOT EXISTS idx_trademark_searches_user_created ON public.trademark_searches (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trademark_results_search ON public.trademark_results (search_id);
CREATE INDEX IF NOT EXISTS idx_trademark_applications_user ON public.trademark_applications (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trademark_monitoring_user ON public.trademark_monitoring (user_id);
CREATE INDEX IF NOT EXISTS idx_trademark_monitoring_due ON public.trademark_monitoring (next_search_at) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_application_payments_user ON public.application_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_supabase_connections_user ON public.supabase_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_user ON public.funnel_events (user_id);
