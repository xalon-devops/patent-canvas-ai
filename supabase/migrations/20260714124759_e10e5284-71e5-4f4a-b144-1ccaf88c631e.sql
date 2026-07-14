-- MPEP knowledge base for RAG-grounded patent drafting
CREATE TABLE IF NOT EXISTS public.mpep_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_number TEXT NOT NULL,
  section_title TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  source_url TEXT,
  token_count INTEGER,
  embedding vector(3072) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_number, chunk_index)
);

-- GRANTs: service_role only. Edge functions read/write; never client-exposed.
GRANT ALL ON public.mpep_chunks TO service_role;

ALTER TABLE public.mpep_chunks ENABLE ROW LEVEL SECURITY;

-- No client access. Service role bypasses RLS; no policies needed for public roles.
CREATE POLICY "Service role only access"
  ON public.mpep_chunks
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- HNSW index on halfvec cast (pgvector 2000-dim limit for full vector index)
CREATE INDEX IF NOT EXISTS mpep_chunks_embedding_idx
  ON public.mpep_chunks
  USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE INDEX IF NOT EXISTS mpep_chunks_section_idx
  ON public.mpep_chunks (section_number);

-- Similarity search function
CREATE OR REPLACE FUNCTION public.match_mpep_chunks(
  query_embedding vector(3072),
  match_count int DEFAULT 5,
  section_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  section_number text,
  section_title text,
  chunk_text text,
  source_url text,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.section_number,
    m.section_title,
    m.chunk_text,
    m.source_url,
    1 - (m.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.mpep_chunks m
  WHERE section_filter IS NULL OR m.section_number LIKE section_filter || '%'
  ORDER BY m.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

-- updated_at trigger
CREATE TRIGGER update_mpep_chunks_updated_at
  BEFORE UPDATE ON public.mpep_chunks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();