-- Enable Row Level Security on all tables
ALTER TABLE public.patent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patent_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prior_art_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for patent_sessions
CREATE POLICY "Users can view their own patent sessions" 
ON public.patent_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own patent sessions" 
ON public.patent_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patent sessions" 
ON public.patent_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patent sessions" 
ON public.patent_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for patent_sections
CREATE POLICY "Users can view patent sections for their sessions" 
ON public.patent_sections 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = patent_sections.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create patent sections for their sessions" 
ON public.patent_sections 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = patent_sections.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update patent sections for their sessions" 
ON public.patent_sections 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = patent_sections.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete patent sections for their sessions" 
ON public.patent_sections 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = patent_sections.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

-- Create policies for ai_questions
CREATE POLICY "Users can view AI questions for their sessions" 
ON public.ai_questions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = ai_questions.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create AI questions for their sessions" 
ON public.ai_questions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = ai_questions.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update AI questions for their sessions" 
ON public.ai_questions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = ai_questions.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete AI questions for their sessions" 
ON public.ai_questions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = ai_questions.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

-- Create policies for prior_art_results
CREATE POLICY "Users can view prior art results for their sessions" 
ON public.prior_art_results 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = prior_art_results.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create prior art results for their sessions" 
ON public.prior_art_results 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = prior_art_results.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update prior art results for their sessions" 
ON public.prior_art_results 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = prior_art_results.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete prior art results for their sessions" 
ON public.prior_art_results 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.patent_sessions 
    WHERE patent_sessions.id = prior_art_results.session_id 
    AND patent_sessions.user_id = auth.uid()
  )
);

-- Create policies for users table (in case we need it)
CREATE POLICY "Users can view their own user record" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can create their own user record" 
ON public.users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own user record" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = id);