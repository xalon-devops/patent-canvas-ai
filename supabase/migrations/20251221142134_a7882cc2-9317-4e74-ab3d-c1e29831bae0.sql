-- Ensure public.users stays in sync with auth.users and support persistent onboarding state

-- 1) Add onboarding completion timestamp (used to hide WelcomeOnboarding permanently per user)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- 2) Backfill: insert missing public.users rows for any existing auth.users (safe idempotent)
INSERT INTO public.users (id, email)
SELECT au.id, au.email
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- 3) Backfill: keep emails aligned (handles users created before triggers / email changes)
UPDATE public.users pu
SET email = au.email
FROM auth.users au
WHERE au.id = pu.id
  AND (pu.email IS DISTINCT FROM au.email);
