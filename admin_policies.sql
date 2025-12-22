-- Enable Admin access to Verification Docs
-- Without this, admins cannot see or approve documents.

-- 1. Allow Admins to View ALL verification docs
CREATE POLICY "Admins can view all docs"
ON public.verification_docs
FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- 2. Allow Admins to Update verification docs (Approve/Reject)
CREATE POLICY "Admins can update docs"
ON public.verification_docs
FOR UPDATE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- 3. Allow Admins to Delete docs (Optional cleanup)
CREATE POLICY "Admins can delete docs"
ON public.verification_docs
FOR DELETE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
