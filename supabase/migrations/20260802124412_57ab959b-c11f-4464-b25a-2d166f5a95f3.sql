GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  UNIQUE (subject, endpoint, window_start)
);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to rate_limits" ON public.rate_limits FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_created_at ON public.api_request_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events (created_at DESC);