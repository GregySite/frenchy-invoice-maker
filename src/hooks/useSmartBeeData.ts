import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SmartBeeClient {
  id?: string;
  name: string;
  address?: string;
  emails?: string[];
}

export interface SmartBeeAccount {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
}

/**
 * Charge le compte et les clients depuis SmartBee (Green Invoice),
 * uniquement si l'utilisateur a enregistré des identifiants SmartBee.
 */
export function useSmartBeeData(enabled = true) {
  const [account, setAccount] = useState<SmartBeeAccount | null>(null);
  const [clients, setClients] = useState<SmartBeeClient[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const { data: creds } = await supabase
        .from("provider_credentials")
        .select("provider, last_check_ok")
        .eq("provider", "smartbee")
        .maybeSingle();

      if (!creds || creds.last_check_ok !== true) return;

      setLoading(true);
      try {
        const [acc, cli] = await Promise.all([
          supabase.functions.invoke("fetch-smartbee", { body: { resource: "account" } }),
          supabase.functions.invoke("fetch-smartbee", { body: { resource: "clients" } }),
        ]);
        if (cancelled) return;
        if (acc.data?.success) setAccount(acc.data.data ?? null);
        if (cli.data?.success) setClients((cli.data.data ?? []) as SmartBeeClient[]);
      } catch {
        /* silencieux : l'utilisateur peut saisir les infos à la main */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { account, clients, loading };
}
