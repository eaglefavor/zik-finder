-- RESTORE ORIGINAL POLICIES
-- This script resets the RLS policies for lodges and profiles to the original working state.

-- 1. LODGES
DROP POLICY IF EXISTS "Lodges are viewable by everyone" ON public.lodges;
DROP POLICY IF EXISTS "Landlords can insert their own lodges" ON public.lodges;
DROP POLICY IF EXISTS "Landlords can update their own lodges" ON public.lodges;
DROP POLICY IF EXISTS "Landlords can delete their own lodges" ON public.lodges;

CREATE POLICY "Lodges are viewable by everyone" 
ON public.lodges FOR SELECT USING (true);

CREATE POLICY "Landlords can insert their own lodges" 
ON public.lodges FOR INSERT WITH CHECK (
    auth.uid() = landlord_id
);

CREATE POLICY "Landlords can update their own lodges" 
ON public.lodges FOR UPDATE USING (auth.uid() = landlord_id);

CREATE POLICY "Landlords can delete their own lodges" 
ON public.lodges FOR DELETE USING (auth.uid() = landlord_id);

-- 2. PROFILES (Just in case)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

-- 3. FAVORITES (If you want to keep the feature, leave this. If you want to kill it to be safe, uncomment below)
-- DROP TABLE IF EXISTS public.favorites;
