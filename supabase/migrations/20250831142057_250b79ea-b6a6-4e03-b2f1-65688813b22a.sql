-- Create patent_ideas table for non-drafted ideas with monitoring
CREATE TABLE public.patent_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  patent_type TEXT NOT NULL CHECK (patent_type IN ('software', 'non-software')),
  data_source JSONB DEFAULT '{}'::jsonb, -- For GitHub links, uploaded files, etc.
  prior_art_monitoring BOOLEAN DEFAULT true,
  last_monitored_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'monitoring' CHECK (status IN ('monitoring', 'drafted', 'abandoned')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create infringement_alerts table for active patent monitoring
CREATE TABLE public.infringement_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patent_session_id UUID,
  patent_idea_id UUID,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('potential_infringement', 'similar_filing', 'competitive_analysis')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create prior_art_monitoring table for daily tracking
CREATE TABLE public.prior_art_monitoring (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patent_session_id UUID,
  patent_idea_id UUID,
  search_query TEXT NOT NULL,
  results_found INTEGER DEFAULT 0,
  new_results_count INTEGER DEFAULT 0,
  highest_similarity_score DECIMAL(3,2),
  monitoring_data JSONB DEFAULT '{}'::jsonb,
  last_search_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  next_search_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patent_documents table for file attachments and media
CREATE TABLE public.patent_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patent_session_id UUID,
  patent_idea_id UUID,
  document_type TEXT NOT NULL CHECK (document_type IN ('image', 'diagram', 'code', 'document', 'graph', 'drawing')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  ai_analysis TEXT,
  extraction_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add new columns to patent_sessions for enhanced functionality
ALTER TABLE public.patent_sessions 
ADD COLUMN patent_type TEXT CHECK (patent_type IN ('software', 'non-software')),
ADD COLUMN data_source JSONB DEFAULT '{}'::jsonb,
ADD COLUMN ai_analysis_complete BOOLEAN DEFAULT false,
ADD COLUMN visual_analysis JSONB DEFAULT '{}'::jsonb,
ADD COLUMN patentability_score DECIMAL(3,2) CHECK (patentability_score >= 0 AND patentability_score <= 1);

-- Enable Row Level Security on new tables
ALTER TABLE public.patent_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infringement_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prior_art_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patent_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for patent_ideas
CREATE POLICY "Users can view their own patent ideas" 
ON public.patent_ideas 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own patent ideas" 
ON public.patent_ideas 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own patent ideas" 
ON public.patent_ideas 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own patent ideas" 
ON public.patent_ideas 
FOR DELETE 
USING (user_id = auth.uid());

-- Create RLS policies for infringement_alerts
CREATE POLICY "Users can view alerts for their patents" 
ON public.infringement_alerts 
FOR SELECT 
USING (
  (patent_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patent_sessions 
    WHERE id = infringement_alerts.patent_session_id AND user_id = auth.uid()
  )) OR
  (patent_idea_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patent_ideas 
    WHERE id = infringement_alerts.patent_idea_id AND user_id = auth.uid()
  ))
);

CREATE POLICY "System can insert infringement alerts" 
ON public.infringement_alerts 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their alerts" 
ON public.infringement_alerts 
FOR UPDATE 
USING (
  (patent_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patent_sessions 
    WHERE id = infringement_alerts.patent_session_id AND user_id = auth.uid()
  )) OR
  (patent_idea_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patent_ideas 
    WHERE id = infringement_alerts.patent_idea_id AND user_id = auth.uid()
  ))
);

-- Create RLS policies for prior_art_monitoring
CREATE POLICY "Users can view monitoring for their patents" 
ON public.prior_art_monitoring 
FOR SELECT 
USING (
  (patent_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patent_sessions 
    WHERE id = prior_art_monitoring.patent_session_id AND user_id = auth.uid()
  )) OR
  (patent_idea_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patent_ideas 
    WHERE id = prior_art_monitoring.patent_idea_id AND user_id = auth.uid()
  ))
);

CREATE POLICY "System can manage prior art monitoring" 
ON public.prior_art_monitoring 
FOR ALL 
USING (true);

-- Create RLS policies for patent_documents
CREATE POLICY "Users can view documents for their patents" 
ON public.patent_documents 
FOR SELECT 
USING (
  (patent_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patent_sessions 
    WHERE id = patent_documents.patent_session_id AND user_id = auth.uid()
  )) OR
  (patent_idea_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patent_ideas 
    WHERE id = patent_documents.patent_idea_id AND user_id = auth.uid()
  ))
);

CREATE POLICY "Users can create documents for their patents" 
ON public.patent_documents 
FOR INSERT 
WITH CHECK (
  (patent_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patent_sessions 
    WHERE id = patent_documents.patent_session_id AND user_id = auth.uid()
  )) OR
  (patent_idea_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM patent_ideas 
    WHERE id = patent_documents.patent_idea_id AND user_id = auth.uid()
  ))
);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patent_ideas_updated_at
BEFORE UPDATE ON public.patent_ideas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_patent_ideas_user_id ON public.patent_ideas(user_id);
CREATE INDEX idx_patent_ideas_status ON public.patent_ideas(status);
CREATE INDEX idx_infringement_alerts_patent_session ON public.infringement_alerts(patent_session_id);
CREATE INDEX idx_infringement_alerts_patent_idea ON public.infringement_alerts(patent_idea_id);
CREATE INDEX idx_prior_art_monitoring_active ON public.prior_art_monitoring(is_active, next_search_at);
CREATE INDEX idx_patent_documents_session ON public.patent_documents(patent_session_id);
CREATE INDEX idx_patent_documents_idea ON public.patent_documents(patent_idea_id);