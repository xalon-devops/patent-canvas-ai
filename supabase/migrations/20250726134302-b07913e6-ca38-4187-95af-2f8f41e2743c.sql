-- Add overlap_claims and difference_claims columns to prior_art_results table
ALTER TABLE public.prior_art_results 
ADD COLUMN overlap_claims TEXT[] DEFAULT '{}',
ADD COLUMN difference_claims TEXT[] DEFAULT '{}';