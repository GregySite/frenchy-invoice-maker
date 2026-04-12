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

    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setAccount(null);
            setClients([]);
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("smartbee_connected")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        if (!profile?.smartbee_connected) {
          if (!cancelled) {
            setAccount(null);
            setClients([]);
          }
          return;
        }

        const [accountResponse, clientsResponse] = await Promise.all([
          supabase.functions.invoke("fetch-smartbee", {
            body: { resource: "account" },
          }),
          supabase.functions.invoke("fetch-smartbee", {
            body: { resource: "clients" },
          }),
        ]);

        const accountMessage = accountResponse.error?.message ?? accountResponse.data?.error;
        const clientsMessage = clientsResponse.error?.message ?? clientsResponse.data?.error;

        if (accountMessage || clientsMessage) {
          throw new Error(accountMessage ?? clientsMessage ?? "Erreur");
        }

        if (!cancelled && accountResponse.data?.success) {
          const a = accountResponse.data.data;
          setAccount({
            name: a.name ?? "",
            address: a.address ?? "",
            phone: a.phone ?? "",
            email: a.email ?? "",
            taxId: a.taxId ?? a.id ?? "",
          });
        }

        if (!cancelled && clientsResponse.data?.success) {
          const list = clientsResponse.data.data?.items ?? clientsResponse.data.data ?? [];
          setClients(list.map((c: Record<string, unknown>) => ({
            id: String(c.id ?? ""),
            name: String(c.name ?? ""),
            address: String(c.address ?? ""),
            emails: Array.isArray(c.emails) ? c.emails : c.email ? [c.email] : [],
            phone: String(c.phone ?? ""),
          })));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchAll();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { account, clients, loading, error };
}
