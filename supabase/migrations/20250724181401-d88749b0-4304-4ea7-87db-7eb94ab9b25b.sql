-- Add download_url field to patent_sessions table
ALTER TABLE public.patent_sessions 
ADD COLUMN download_url TEXT;

-- Create storage bucket for patent files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('patents', 'patents', true);

-- Create storage policies for patent files
CREATE POLICY "Users can view patent files for their sessions" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'patents' 
  AND EXISTS (
    SELECT 1 FROM patent_sessions 
    WHERE patent_sessions.user_id = auth.uid() 
    AND storage.filename(name) LIKE '%' || patent_sessions.id::text || '%'
  )
);

CREATE POLICY "System can upload patent files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'patents');