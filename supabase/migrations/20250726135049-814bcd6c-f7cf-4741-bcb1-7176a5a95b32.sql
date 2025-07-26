-- Create storage bucket for patent documents
INSERT INTO storage.buckets (id, name, public) VALUES ('patent-docs', 'patent-docs', false);

-- Create storage policies for patent documents
CREATE POLICY "Users can view their own patent documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'patent-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own patent documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'patent-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own patent documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'patent-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own patent documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'patent-docs' AND auth.uid()::text = (storage.foldername(name))[1]);