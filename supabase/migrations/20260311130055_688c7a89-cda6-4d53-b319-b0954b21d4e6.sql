
-- =============================================
-- FIX 1: application_payments - Remove public INSERT, restrict to admin + service_role
-- =============================================

-- Drop the existing permissive public INSERT policy
DROP POLICY IF EXISTS "Users can create their own payments" ON public.application_payments;

-- Add service_role INSERT policy (for edge functions: create-payment, verify-payment, stripe-webhook)
CREATE POLICY "Service role can insert application payments"
  ON public.application_payments
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add admin-only INSERT policy (for AdminUserManagement free grants)
CREATE POLICY "Admins can insert application payments"
  ON public.application_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- FIX 2: user_search_credits - Remove public INSERT, restrict to service_role only
-- =============================================

-- Drop the existing public INSERT policy
DROP POLICY IF EXISTS "Users can create their own search credits" ON public.user_search_credits;

-- Service role already has ALL policy, but let's ensure edge functions can insert
-- The existing "Service role can manage search credits" ALL policy covers this.

-- Also remove the UPDATE capability for regular users (credits should only be modified via decrement_search_credit function)
-- Currently there's no public UPDATE policy, which is correct.
