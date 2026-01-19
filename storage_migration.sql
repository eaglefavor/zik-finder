-- Create Storage Bucket for Lodges if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('lodge-images', 'lodge-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Give public access to view images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'lodge-images' );

-- Policy: Allow authenticated users to upload images (Insert)
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'lodge-images' AND auth.role() = 'authenticated' );

-- Policy: Allow users to update their own images (Resumable uploads might use UPDATE)
CREATE POLICY "Owner Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'lodge-images' AND auth.uid() = owner );

-- Policy: Allow users to delete their own images
CREATE POLICY "Owner Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'lodge-images' AND auth.uid() = owner );
