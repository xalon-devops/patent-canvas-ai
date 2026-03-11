CREATE OR REPLACE FUNCTION public.is_paid_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = _user_id
      AND (status = 'active' OR status = 'trialing')
      AND plan != 'free'
  )
$$;