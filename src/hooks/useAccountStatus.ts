import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AccountStatus = "pending" | "active" | "suspended";

export function useAccountStatus(userId: string | undefined) {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [profile, roles] = await Promise.all([
        supabase.from("profiles").select("account_status").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin"),
      ]);
      if (cancelled) return;
      setStatus(((profile.data?.account_status as AccountStatus) ?? "pending") as AccountStatus);
      setIsAdmin((roles.data ?? []).length > 0);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { status, isAdmin, loading };
}
