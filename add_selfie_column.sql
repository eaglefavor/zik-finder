-- Add selfie_path to verification_docs
ALTER TABLE public.verification_docs 
ADD COLUMN IF NOT EXISTS selfie_path TEXT;

-- Update RLS to ensure new column is protected (Policies usually cover entire rows, but good to double check if column-level security was used. Here it's row-level, so we are good).
