-- Create table for tracking email notifications
CREATE TABLE public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- 'patent_completion', 'welcome', 'subscription_update'
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for email notifications
CREATE POLICY "Users can view their own email notifications" 
ON public.email_notifications 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "System can insert email notifications" 
ON public.email_notifications 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update email notifications" 
ON public.email_notifications 
FOR UPDATE 
USING (true);

-- Create table for payment transactions
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  payment_type TEXT NOT NULL, -- 'subscription', 'one_time'
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for payment transactions
CREATE POLICY "Users can view their own payment transactions" 
ON public.payment_transactions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all payment transactions" 
ON public.payment_transactions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert payment transactions" 
ON public.payment_transactions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update payment transactions" 
ON public.payment_transactions 
FOR UPDATE 
USING (true);

-- Create index for better performance
CREATE INDEX idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_stripe_session_id ON public.payment_transactions(stripe_session_id);
CREATE INDEX idx_email_notifications_user_id ON public.email_notifications(user_id);
CREATE INDEX idx_email_notifications_status ON public.email_notifications(status);

-- Update trigger for payment transactions
CREATE OR REPLACE FUNCTION public.update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_transactions_updated_at();