
-- Fix the overly permissive INSERT policy on api_usage
-- Edge functions use service_role key which bypasses RLS, so we restrict to authenticated users owning the key
DROP POLICY "Service can insert api_usage" ON public.api_usage;
CREATE POLICY "Users can insert own api_usage" ON public.api_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
