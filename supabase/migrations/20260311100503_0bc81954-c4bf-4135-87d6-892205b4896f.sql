-- Fix CRITICAL: Remove public UPDATE policy on user_search_credits to prevent credit manipulation
DROP POLICY IF EXISTS "Users can update their own search credits" ON public.user_search_credits;

-- Create a security definer function for controlled credit decrement only
CREATE OR REPLACE FUNCTION public.decrement_search_credit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining int;
BEGIN
  SELECT free_searches_remaining INTO remaining
  FROM public.user_search_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF remaining IS NULL OR remaining <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.user_search_credits
  SET free_searches_remaining = free_searches_remaining - 1,
      searches_used = searches_used + 1,
      last_search_at = now(),
      updated_at = now()
  WHERE user_id = _user_id;

  RETURN true;
END;
$$;