import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SmartBeeClient {
  id: string;
  name: string;
  address?: string;
  emails?: string[];
  phone?: string;
}

export interface SmartBeeAccount {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string; // ח.פ. / ע.מ.
}

export interface SmartBeeData {
  account: SmartBeeAccount | null;
  clients: SmartBeeClient[];
  loading: boolean;
  error: string | null;
}

export function useSmartBeeData(enabled: boolean): SmartBeeData {
  const [account, setAccount] = useState<SmartBeeAccount | null>(null);
  const [clients, setClients] = useState<SmartBeeClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        // Infos du compte
        const { data: accData, error: accErr } = await supabase.functions.invoke("fetch-smartbee", {
          body: { resource: "account" },
        });
        if (!accErr && accData?.success) {
          const a = accData.data;
          setAccount({
            name: a.name ?? "",
            address: a.address ?? "",
            phone: a.phone ?? "",
            email: a.email ?? "",
            taxId: a.taxId ?? a.id ?? "",
          });
        }

        // Clients
        const { data: cliData, error: cliErr } = await supabase.functions.invoke("fetch-smartbee", {
          body: { resource: "clients" },
        });
        if (!cliErr && cliData?.success) {
          const list = cliData.data?.items ?? cliData.data ?? [];
          setClients(list.map((c: Record<string, unknown>) => ({
            id: String(c.id ?? ""),
            name: String(c.name ?? ""),
            address: String(c.address ?? ""),
            emails: Array.isArray(c.emails) ? c.emails : c.email ? [c.email] : [],
            phone: String(c.phone ?? ""),
          })));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [enabled]);

  return { account, clients, loading, error };
}
