-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add user_search_credits table to track free trial searches
CREATE TABLE IF NOT EXISTS public.user_search_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  searches_used INTEGER NOT NULL DEFAULT 0,
  free_searches_remaining INTEGER NOT NULL DEFAULT 3,
  last_search_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_search_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own search credits"
  ON public.user_search_credits
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own search credits"
  ON public.user_search_credits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own search credits"
  ON public.user_search_credits
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Edge functions can manage search credits"
  ON public.user_search_credits
  FOR ALL
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_user_search_credits_updated_at
  BEFORE UPDATE ON public.user_search_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add embedding column to prior_art_results for semantic search
ALTER TABLE public.prior_art_results 
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'patentsview',
  ADD COLUMN IF NOT EXISTS patent_date DATE,
  ADD COLUMN IF NOT EXISTS assignee TEXT;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS prior_art_embedding_idx 
  ON public.prior_art_results 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Add draft_iterations table to track refinement process
CREATE TABLE IF NOT EXISTS public.draft_iterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.patent_sessions(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  section_type TEXT NOT NULL,
  content TEXT,
  critique TEXT,
  quality_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.draft_iterations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view iterations for their sessions"
  ON public.draft_iterations
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.patent_sessions
    WHERE patent_sessions.id = draft_iterations.session_id
    AND patent_sessions.user_id = auth.uid()
  ));

CREATE POLICY "System can insert iterations"
  ON public.draft_iterations
  FOR INSERT
  WITH CHECK (true);

-- Add email preferences to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{"draft_complete": true, "payment_received": true, "prior_art_alert": true, "weekly_digest": true}'::jsonb;