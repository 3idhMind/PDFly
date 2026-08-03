
-- Explicit deny-insert policies for log tables (defense in depth; service_role
-- bypasses RLS and continues to write these tables from edge functions).
CREATE POLICY "No client inserts into api_request_logs"
  ON public.api_request_logs FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "No client inserts into security_events"
  ON public.security_events FOR INSERT TO authenticated, anon
  WITH CHECK (false);

-- Lock down SECURITY DEFINER functions. Trigger functions don't need any
-- direct EXECUTE grants. has_role is called from RLS policies, so it must
-- remain executable by authenticated (but not anon).
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
