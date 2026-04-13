-- Fix 1: Restrict feedback SELECT to submitter only (match by email)
DROP POLICY IF EXISTS "Only authenticated users can view feedback" ON public.feedback;

CREATE POLICY "Submitters view own feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Fix 2: Restrict storage INSERT to user's own folder
DROP POLICY IF EXISTS "Service role can insert PDFs" ON storage.objects;

CREATE POLICY "Users can insert own PDFs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'generated-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );