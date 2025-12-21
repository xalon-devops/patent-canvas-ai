-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, email_preferences)
  VALUES (
    new.id,
    new.email,
    '{"weekly_digest": true, "draft_complete": true, "prior_art_alert": true, "payment_received": true}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email;
  RETURN new;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users who don't have profiles
INSERT INTO public.users (id, email, email_preferences)
SELECT 
  au.id,
  au.email,
  '{"weekly_digest": true, "draft_complete": true, "prior_art_alert": true, "payment_received": true}'::jsonb
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;