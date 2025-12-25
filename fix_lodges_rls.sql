-- Policies for lodges table
ALTER TABLE public.lodges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to be safe
DROP POLICY IF EXISTS "Anyone can view lodges" ON public.lodges;
DROP POLICY IF EXISTS "Landlords can manage their own lodges" ON public.lodges;
DROP POLICY IF EXISTS "Service roles can bypass RLS" ON public.lodges;

-- 1. Public can view all lodges
CREATE POLICY "Anyone can view lodges"
ON public.lodges FOR SELECT
USING (true);

-- 2. Landlords can insert, update, and delete their own lodges
CREATE POLICY "Landlords can manage their own lodges"
ON public.lodges FOR ALL
USING (auth.uid() = landlord_id)
WITH CHECK (auth.uid() = landlord_id);

-- 3. Allow triggers (running as postgres) to read lodge data
-- This is critical for the view milestone trigger to be able to read lodge.title etc.
CREATE POLICY "Service roles can bypass RLS"
ON public.lodges FOR SELECT
TO postgres, service_role
USING (true);