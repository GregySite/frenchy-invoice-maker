CREATE TABLE IF NOT EXISTS public.provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  last_check_ok boolean,
  last_check_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_credentials TO authenticated;
GRANT ALL ON public.provider_credentials TO service_role;

ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own provider credentials" ON public.provider_credentials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own provider credentials" ON public.provider_credentials
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own provider credentials" ON public.provider_credentials
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own provider credentials" ON public.provider_credentials
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_number text,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS error_message text;