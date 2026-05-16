-- Drop the trigger that depended on admin_config
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Recreate the signup handler without referencing admin_config
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Drop the admin_config table entirely; admin email now lives only in env/secrets
DROP TABLE IF EXISTS public.admin_config;