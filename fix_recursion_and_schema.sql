-- Fix Infinite Recursion and Missing Column
-- 1. Create a secure helper to check for admin role without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Drop the recursive policy on profiles
DROP POLICY IF EXISTS "Public and Active profiles are viewable" ON public.profiles;

-- 3. Recreate the policy using the safe helper
CREATE POLICY "Public and Active profiles are viewable"
ON public.profiles FOR SELECT
USING (
    auth.uid() = id -- Own profile
    OR role = 'landlord' -- Landlords are public
    OR (role = 'student' AND EXISTS (SELECT 1 FROM public.requests WHERE student_id = id)) -- Students with active requests
    OR public.is_admin() -- Admins (using safe helper)
);

-- 4. Fix missing column in requests table
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days');

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_requests_expires_at ON public.requests(expires_at);

-- 6. Grant execute permission on the new function
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO service_role;
