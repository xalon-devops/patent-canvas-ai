-- Create application_payments table to track $1,000 patent filing payments
CREATE TABLE IF NOT EXISTS public.application_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.patent_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_id TEXT,
  stripe_session_id TEXT,
  amount INTEGER NOT NULL DEFAULT 100000,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(application_id)
);

-- Enable RLS
ALTER TABLE public.application_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment records
CREATE POLICY "Users can view their own payments"
  ON public.application_payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own payment records
CREATE POLICY "Users can create their own payments"
  ON public.application_payments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_application_payments_updated_at
  BEFORE UPDATE ON public.application_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update subscriptions table to support check_and_see plan
ALTER TABLE public.subscriptions 
  ALTER COLUMN plan DROP DEFAULT;

COMMENT ON TABLE public.application_payments IS 'Tracks $1,000 one-time payments for patent applications';
COMMENT ON TABLE public.subscriptions IS 'Tracks $9.99/month Check & See subscriptions and other plans';