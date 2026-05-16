
-- 1. Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. RLS for user_roles
CREATE POLICY "Users view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. security_events
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_security_events_created ON public.security_events(created_at DESC);
CREATE INDEX idx_security_events_type ON public.security_events(event_type);

CREATE POLICY "Admins read security_events" ON public.security_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. api_request_logs
CREATE TABLE public.api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT,
  latency_ms INT,
  ip_address TEXT,
  user_id UUID,
  api_key_id UUID,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_api_request_logs_created ON public.api_request_logs(created_at DESC);
CREATE INDEX idx_api_request_logs_request_id ON public.api_request_logs(request_id);

CREATE POLICY "Admins read api_request_logs" ON public.api_request_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Admin email config (single-row table; easy to edit)
CREATE TABLE public.admin_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  admin_email TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = TRUE)
);

ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read admin_config" ON public.admin_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.admin_config (id, admin_email) VALUES (TRUE, 'databasedevs.20@gmail.com');

-- 7. Auto-grant admin role on signup if email matches
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email TEXT;
BEGIN
  SELECT admin_email INTO v_admin_email FROM public.admin_config WHERE id = TRUE;

  IF NEW.email = v_admin_email THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 8. Backfill: if admin email already exists in auth.users, grant admin
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
JOIN public.admin_config c ON u.email = c.admin_email
ON CONFLICT DO NOTHING;
