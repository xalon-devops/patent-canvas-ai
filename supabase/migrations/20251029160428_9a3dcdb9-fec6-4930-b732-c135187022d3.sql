-- Add semantic and keyword score columns to prior_art_results table
ALTER TABLE prior_art_results 
ADD COLUMN IF NOT EXISTS semantic_score DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS keyword_score DECIMAL(5,3) DEFAULT 0;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_prior_art_semantic_score ON prior_art_results(semantic_score DESC);

-- Update existing records to have default scores
UPDATE prior_art_results 
SET semantic_score = 0, keyword_score = similarity_score 
WHERE semantic_score IS NULL OR keyword_score IS NULL;