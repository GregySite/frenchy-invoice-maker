REVOKE INSERT ON public.profiles FROM authenticated;
GRANT INSERT (id, full_name, company_name, address, phone, email, siret, smartbee_api_key, smartbee_connected)
  ON public.profiles TO authenticated;