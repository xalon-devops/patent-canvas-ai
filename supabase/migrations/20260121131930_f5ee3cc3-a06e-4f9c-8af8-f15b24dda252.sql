-- Add a column for stripe_session_id to enable unique constraint
ALTER TABLE public.email_notifications 
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- Create unique partial index: only one abandoned_checkout email per stripe session
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_abandoned_checkout_per_session 
ON public.email_notifications (stripe_session_id) 
WHERE email_type = 'abandoned_checkout' AND stripe_session_id IS NOT NULL;

-- Also add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_notifications_type_recipient 
ON public.email_notifications (email_type, recipient_email, sent_at DESC);