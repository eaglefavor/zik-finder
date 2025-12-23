-- Fix relationships for requests table
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_student_id_fkey;

ALTER TABLE public.requests
ADD CONSTRAINT requests_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;
