-- Ensure Nash has admin role and premium subscription
INSERT INTO public.user_roles (user_id, role) 
VALUES ('0290fb0f-0089-4f3d-8507-08de9e5f7b86', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.subscriptions (user_id, plan, status, current_period_start, current_period_end)
VALUES ('0290fb0f-0089-4f3d-8507-08de9e5f7b86', 'premium', 'active', now(), now() + interval '1 year')
ON CONFLICT (user_id) DO UPDATE SET
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  current_period_start = EXCLUDED.current_period_start,
  current_period_end = EXCLUDED.current_period_end,
  updated_at = now();