
-- Add storage_path column to generated_documents
ALTER TABLE public.generated_documents ADD COLUMN IF NOT EXISTS storage_path text;

-- Allow updates on generated_documents for service role (edge functions use service role)
-- Add RLS policy for users to delete own documents
CREATE POLICY "Users can delete own documents" ON public.generated_documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create storage bucket for generated PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-pdfs', 'generated-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can read their own files
CREATE POLICY "Users can read own PDFs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'generated-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Service role can insert (edge functions)
CREATE POLICY "Service role can insert PDFs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generated-pdfs');

-- Service role can delete (cleanup)  
CREATE POLICY "Service role can delete PDFs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'generated-pdfs');
