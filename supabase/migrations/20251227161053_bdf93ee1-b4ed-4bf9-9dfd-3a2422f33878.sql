
-- Backfill missing profiles for existing auth users
INSERT INTO public.profiles (user_id, display_name, created_at, updated_at)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1)),
  COALESCE(au.created_at, now()),
  now()
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Backfill missing users table entries for existing auth users
INSERT INTO public.users (id, email, email_preferences, created_at)
SELECT 
  au.id,
  au.email,
  '{"weekly_digest": true, "draft_complete": true, "prior_art_alert": true, "payment_received": true}'::jsonb,
  COALESCE(au.created_at, now())
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- Recreate the trigger for new user profile creation (drop if exists, then create)
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Recreate the trigger for new user entry (drop if exists, then create)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
