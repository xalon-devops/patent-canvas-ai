-- Add overlaps and differences columns to prior_art_results table
ALTER TABLE public.prior_art_results 
ADD COLUMN overlaps TEXT[] DEFAULT '{}',
ADD COLUMN differences TEXT[] DEFAULT '{}';