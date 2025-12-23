-- Fix ambiguous relationships by ensuring only ONE foreign key exists

-- 1. Drop known constraint names (one of these might be the duplicate)
ALTER TABLE public.lodges DROP CONSTRAINT IF EXISTS lodges_landlord_id_fkey;
ALTER TABLE public.lodges DROP CONSTRAINT IF EXISTS lodges_profiles_fkey; -- Another common auto-name

-- 2. Add back ONE single constraint
ALTER TABLE public.lodges
ADD CONSTRAINT lodges_landlord_id_fkey
FOREIGN KEY (landlord_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;
