-- Fix RLS policies for lodges table

-- 1. Drop existing policies to be safe (names might vary, so we drop likely ones)
DROP POLICY IF EXISTS "Lodges are viewable by everyone" ON public.lodges;
DROP POLICY IF EXISTS "Landlords can insert their own lodges" ON public.lodges;
DROP POLICY IF EXISTS "Landlords can update their own lodges" ON public.lodges;
DROP POLICY IF EXISTS "Landlords can delete their own lodges" ON public.lodges;

-- 2. Re-enable RLS (just in case)
ALTER TABLE public.lodges ENABLE ROW LEVEL SECURITY;

-- 3. Re-create policies

-- READ: Everyone can see all lodges
CREATE POLICY "Lodges are viewable by everyone" 
ON public.lodges FOR SELECT USING (true);

-- INSERT: Only verified landlords (optional check) or just logged-in landlords
-- We'll stick to the basic "is landlord" check for now to match previous logic
CREATE POLICY "Landlords can insert their own lodges" 
ON public.lodges FOR INSERT WITH CHECK (
    auth.uid() = landlord_id
);

-- UPDATE: Only owner
CREATE POLICY "Landlords can update their own lodges" 
ON public.lodges FOR UPDATE USING (auth.uid() = landlord_id);

-- DELETE: Only owner
CREATE POLICY "Landlords can delete their own lodges" 
ON public.lodges FOR DELETE USING (auth.uid() = landlord_id);
