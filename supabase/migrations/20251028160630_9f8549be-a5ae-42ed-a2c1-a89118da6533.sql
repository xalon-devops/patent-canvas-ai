-- Add project-specific columns to supabase_connections
ALTER TABLE public.supabase_connections
ADD COLUMN IF NOT EXISTS project_ref TEXT,
ADD COLUMN IF NOT EXISTS project_name TEXT,
ADD COLUMN IF NOT EXISTS project_region TEXT,
ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'pending';

-- Update existing connections to be 'active' status
UPDATE public.supabase_connections
SET connection_status = 'active'
WHERE connection_status IS NULL;

COMMENT ON COLUMN public.supabase_connections.project_ref IS 'The Supabase project reference ID (e.g., jdkogqskjsmwlhigaecb)';
COMMENT ON COLUMN public.supabase_connections.project_name IS 'Human-readable project name';
COMMENT ON COLUMN public.supabase_connections.project_region IS 'Project region (e.g., us-east-1)';
COMMENT ON COLUMN public.supabase_connections.connection_status IS 'Connection status: pending, active, error';