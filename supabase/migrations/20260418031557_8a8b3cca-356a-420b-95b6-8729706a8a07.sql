-- 1. Purge stale DB rows older than 30 minutes
DELETE FROM public.generated_documents
WHERE created_at < (now() - interval '30 minutes');

-- 2. Unschedule the broken cron job
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-old-documents');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Recreate cron job with embedded anon key (the function accepts both service_role and anon auth)
SELECT cron.schedule(
  'cleanup-old-documents',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nlnqpcfezbssssrwddyl.supabase.co/functions/v1/cleanup-documents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbnFwY2ZlemJzc3NzcndkZHlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODQyODIsImV4cCI6MjA4ODU2MDI4Mn0.KzdwiKWJdok4VIeoNYdZK1RJi7nDSlWm3oq3zzls4Ds'
    ),
    body := '{}'::jsonb
  );
  $cron$
);