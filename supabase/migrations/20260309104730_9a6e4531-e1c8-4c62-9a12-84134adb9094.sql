DROP POLICY IF EXISTS "Service role can delete PDFs" ON storage.objects;

CREATE POLICY "Users delete own PDFs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'generated-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );