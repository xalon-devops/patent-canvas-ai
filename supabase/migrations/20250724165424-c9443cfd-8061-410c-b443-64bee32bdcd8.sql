-- Critical Security Fix: Make user_id and session_id columns NOT NULL
-- This prevents policy bypasses and ensures proper ownership

-- First, clean up any existing null values (shouldn't be any with current RLS policies)
DELETE FROM patent_sessions WHERE user_id IS NULL;
DELETE FROM patent_sections WHERE session_id IS NULL;
DELETE FROM ai_questions WHERE session_id IS NULL;
DELETE FROM prior_art_results WHERE session_id IS NULL;

-- Make user_id NOT NULL in patent_sessions (critical security fix)
ALTER TABLE patent_sessions 
ALTER COLUMN user_id SET NOT NULL;

-- Make session_id NOT NULL in all related tables
ALTER TABLE patent_sections 
ALTER COLUMN session_id SET NOT NULL;

ALTER TABLE ai_questions 
ALTER COLUMN session_id SET NOT NULL;

ALTER TABLE prior_art_results 
ALTER COLUMN session_id SET NOT NULL;

-- Add foreign key constraints for data integrity
ALTER TABLE patent_sections 
ADD CONSTRAINT fk_patent_sections_session 
FOREIGN KEY (session_id) REFERENCES patent_sessions(id) ON DELETE CASCADE;

ALTER TABLE ai_questions 
ADD CONSTRAINT fk_ai_questions_session 
FOREIGN KEY (session_id) REFERENCES patent_sessions(id) ON DELETE CASCADE;

ALTER TABLE prior_art_results 
ADD CONSTRAINT fk_prior_art_results_session 
FOREIGN KEY (session_id) REFERENCES patent_sessions(id) ON DELETE CASCADE;

-- Add check constraint to ensure valid status values
ALTER TABLE patent_sessions 
ADD CONSTRAINT check_valid_status 
CHECK (status IN ('in_progress', 'completed', 'filed', 'draft'));

-- Add check constraint for section types
ALTER TABLE patent_sections 
ADD CONSTRAINT check_valid_section_type 
CHECK (section_type IN ('abstract', 'field', 'background', 'summary', 'claims', 'drawings', 'description'));