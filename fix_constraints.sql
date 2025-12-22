-- Fix Foreign Key on verification_docs to ensure CASCADE delete works
ALTER TABLE public.verification_docs
DROP CONSTRAINT IF EXISTS verification_docs_landlord_id_fkey;

ALTER TABLE public.verification_docs
ADD CONSTRAINT verification_docs_landlord_id_fkey
FOREIGN KEY (landlord_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Just to be safe, ensure lodges also has it
ALTER TABLE public.lodges
DROP CONSTRAINT IF EXISTS lodges_landlord_id_fkey;

ALTER TABLE public.lodges
ADD CONSTRAINT lodges_landlord_id_fkey
FOREIGN KEY (landlord_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- And requests
ALTER TABLE public.requests
DROP CONSTRAINT IF EXISTS requests_student_id_fkey;

ALTER TABLE public.requests
ADD CONSTRAINT requests_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;
