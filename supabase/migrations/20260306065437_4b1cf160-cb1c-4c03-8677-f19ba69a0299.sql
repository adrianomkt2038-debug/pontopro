-- Allow authenticated users to upload to face-photos bucket
CREATE POLICY "Authenticated users can upload face photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'face-photos');

-- Allow authenticated users to update (upsert) face photos
CREATE POLICY "Authenticated users can update face photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'face-photos');

-- Allow public read access to face photos
CREATE POLICY "Public can read face photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'face-photos');

-- Allow authenticated users to delete their own face photos
CREATE POLICY "Authenticated users can delete face photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'face-photos');