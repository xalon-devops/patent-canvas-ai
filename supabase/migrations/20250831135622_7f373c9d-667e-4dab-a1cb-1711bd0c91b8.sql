-- Create check-subscription edge function permission policies
CREATE POLICY "Edge functions can upsert subscriptions" ON public.subscriptions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Edge functions can update subscriptions" ON public.subscriptions
FOR UPDATE
USING (true);

-- Update payment transactions table to allow one-time payments
ALTER TABLE public.payment_transactions 
ADD COLUMN IF NOT EXISTS application_id uuid;

-- Create policy for edge functions to update payment transactions
CREATE POLICY "Edge functions can update payment transactions" ON public.payment_transactions
FOR ALL
USING (true);