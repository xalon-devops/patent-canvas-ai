-- Add RLS policies to allow edge functions to update application_payments
CREATE POLICY "Edge functions can update application payments"
  ON public.application_payments
  FOR UPDATE
  USING (true);

-- Add index for faster payment lookups
CREATE INDEX IF NOT EXISTS idx_application_payments_stripe_session 
  ON public.application_payments(stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_application_payments_application 
  ON public.application_payments(application_id);

-- Ensure subscriptions has proper index
CREATE INDEX IF NOT EXISTS idx_subscriptions_user 
  ON public.subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe 
  ON public.subscriptions(stripe_subscription_id);

-- Add helpful comment
COMMENT ON POLICY "Edge functions can update application payments" ON public.application_payments 
  IS 'Allows Stripe webhook to update payment status after successful payment';