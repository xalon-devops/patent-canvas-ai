-- Fix function search path security warnings by dropping and recreating
DROP TRIGGER IF EXISTS update_patent_ideas_updated_at ON public.patent_ideas;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_patent_ideas_updated_at
BEFORE UPDATE ON public.patent_ideas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();