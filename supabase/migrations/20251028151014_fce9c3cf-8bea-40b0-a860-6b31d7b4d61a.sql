-- Create table for storing Supabase OAuth connections
CREATE TABLE public.supabase_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT[] DEFAULT ARRAY['all'],
  connection_metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supabase_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own connections
CREATE POLICY "Users can view their own connections"
  ON public.supabase_connections
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own connections
CREATE POLICY "Users can delete their own connections"
  ON public.supabase_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Edge functions can manage connections
CREATE POLICY "Edge functions can manage connections"
  ON public.supabase_connections
  FOR ALL
  USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_supabase_connections_updated_at
  BEFORE UPDATE ON public.supabase_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();