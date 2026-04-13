
-- Add retry_count column to generated_documents
ALTER TABLE public.generated_documents ADD COLUMN retry_count integer NOT NULL DEFAULT 0;

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
