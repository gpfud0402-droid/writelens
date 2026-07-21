DROP POLICY IF EXISTS "Users can read their own submission images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own submission images" ON storage.objects;

CREATE POLICY "Users can read their own submission images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own submission images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );