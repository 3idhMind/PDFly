
-- Fix feedback INSERT policy: restrict email to authenticated user's own email
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Authenticated users submit own feedback"
  ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
  );

-- Fix all RESTRICTIVE policies to PERMISSIVE (drop and recreate)
-- api_keys
DROP POLICY IF EXISTS "Users can view own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can insert own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update own api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete own api_keys" ON public.api_keys;
CREATE POLICY "Users can view own api_keys" ON public.api_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own api_keys" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own api_keys" ON public.api_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own api_keys" ON public.api_keys FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- api_usage
DROP POLICY IF EXISTS "Users can view own api_usage" ON public.api_usage;
DROP POLICY IF EXISTS "Users can insert own api_usage" ON public.api_usage;
CREATE POLICY "Users can view own api_usage" ON public.api_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own api_usage" ON public.api_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- feedback SELECT
DROP POLICY IF EXISTS "Submitters view own feedback" ON public.feedback;
CREATE POLICY "Submitters view own feedback" ON public.feedback FOR SELECT TO authenticated USING (email = (SELECT email FROM auth.users WHERE id = auth.uid())::text);

-- generated_documents
DROP POLICY IF EXISTS "Users can view own documents" ON public.generated_documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.generated_documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.generated_documents;
CREATE POLICY "Users can view own documents" ON public.generated_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.generated_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.generated_documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
