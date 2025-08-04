-- Add technical_analysis column to patent_sessions table
ALTER TABLE public.patent_sessions 
ADD COLUMN technical_analysis text;