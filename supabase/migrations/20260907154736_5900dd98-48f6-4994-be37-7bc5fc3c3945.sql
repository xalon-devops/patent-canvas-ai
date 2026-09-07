ALTER TABLE public.trademark_results
  ADD COLUMN IF NOT EXISTS verdict TEXT,
  ADD COLUMN IF NOT EXISTS verdict_summary TEXT,
  ADD COLUMN IF NOT EXISTS likelihood_of_confusion TEXT,
  ADD COLUMN IF NOT EXISTS recommendation TEXT,
  ADD COLUMN IF NOT EXISTS first_use_date TEXT,
  ADD COLUMN IF NOT EXISTS first_use_evidence TEXT,
  ADD COLUMN IF NOT EXISTS is_applicant_use BOOLEAN NOT NULL DEFAULT false;