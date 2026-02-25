
-- Tighten funnel_events INSERT: require session_id to be non-empty and event_type/funnel_step non-empty
DROP POLICY IF EXISTS "Anyone can insert funnel events" ON public.funnel_events;

CREATE POLICY "Anyone can insert funnel events with valid data"
ON public.funnel_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(session_id) > 0
  AND length(event_type) > 0
  AND length(funnel_step) > 0
);
