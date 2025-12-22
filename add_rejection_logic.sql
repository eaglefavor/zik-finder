-- 1. Add rejection_reason column
ALTER TABLE public.verification_docs 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Update the status constraint to allow 'rejected'
-- Note: We first drop the existing constraint. Supabase usually names it 'verification_docs_status_check'
ALTER TABLE public.verification_docs 
DROP CONSTRAINT IF EXISTS verification_docs_status_check;

ALTER TABLE public.verification_docs 
ADD CONSTRAINT verification_docs_status_check 
CHECK (status IN ('pending', 'approved', 'rejected'));
