import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProviderCredentialRow {
  provider: string;
  credentials: Record<string, string>;
  is_default: boolean;
  last_check_ok: boolean | null;
  last_check_error: string | null;
}

export function useProviderCredentials() {
  const [rows, setRows] = useState<ProviderCredentialRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("provider_credentials")
      .select("provider, credentials, is_default, last_check_ok, last_check_error");
    setRows(
      (data ?? []).map((r) => ({
        provider: r.provider,
        credentials: (r.credentials ?? {}) as Record<string, string>,
        is_default: r.is_default,
        last_check_ok: r.last_check_ok,
        last_check_error: r.last_check_error,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const connected = rows.filter((r) => Object.keys(r.credentials).length > 0);
  const defaultProvider = connected.find((r) => r.is_default)?.provider ?? connected[0]?.provider ?? null;

  return { rows, connected, defaultProvider, loading, reload };
}
