-- 1. Create the storage bucket for secure documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('secure-docs', 'secure-docs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to avoid conflicts if they were partially applied
DROP POLICY IF EXISTS "Landlords can upload documents to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Owners and Admins can view documents" ON storage.objects;

-- 3. Re-apply the storage policies
CREATE POLICY "Landlords can upload documents to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'secure-docs' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners and Admins can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'secure-docs' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
);
