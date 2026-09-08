-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins read all roles" ON public.user_roles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Account status on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.validate_account_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.account_status NOT IN ('pending','active','suspended') THEN
    RAISE EXCEPTION 'invalid account_status: %', NEW.account_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_validate_account_status
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_account_status();

-- Prevent normal users from ever updating account_status: column-level grants
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, company_name, address, phone, email, siret, smartbee_api_key, smartbee_connected)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Admins can read every profile
CREATE POLICY "Admins read all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admin-only status change, bypasses column grants via SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.admin_set_account_status(_user_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _status NOT IN ('pending','active','suspended') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE public.profiles SET account_status = _status WHERE id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text) TO authenticated;