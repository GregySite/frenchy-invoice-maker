import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShieldCheck, Mail } from "lucide-react";

interface Row {
  id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  account_status: string;
  created_at: string;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  created_at: string;
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: statusLoading } = useAccountStatus(user?.id);
  const [rows, setRows] = useState<Row[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, company_name, account_status, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Row[]);
    const { data: msgs } = await supabase
      .from("contact_messages")
      .select("id, name, email, phone, message, created_at")
      .order("created_at", { ascending: false });
    setMessages((msgs ?? []) as ContactMessage[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const setStatus = async (id: string, status: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_set_account_status", {
      _user_id: id,
      _status: status,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Statut mis à jour");
      await load();
    }
    setBusy(null);
  };

  if (authLoading || statusLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-invoice-accent" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-muted-foreground text-sm">Accès réservé à l'administrateur.</p>
        <Link to="/" className="text-invoice-accent text-sm hover:underline">Retour</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto flex items-center gap-2 px-4 h-14">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <ShieldCheck className="h-5 w-5 text-invoice-accent" />
          <span className="font-display text-lg">Administration</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-3">
        {loading && <Loader2 className="h-5 w-5 animate-spin text-invoice-accent" />}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun compte.</p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">{r.email ?? r.id}</p>
              <p className="text-xs text-muted-foreground truncate">
                {r.full_name || r.company_name || "—"} · inscrit le{" "}
                {new Date(r.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full border ${
                r.account_status === "active"
                  ? "border-emerald-500 text-emerald-500"
                  : r.account_status === "suspended"
                    ? "border-destructive text-destructive"
                    : "border-border text-muted-foreground"
              }`}
            >
              {r.account_status === "active" ? "Actif" : r.account_status === "suspended" ? "Suspendu" : "En attente"}
            </span>
            <div className="flex gap-2">
              {r.account_status !== "active" && (
                <Button size="sm" disabled={busy === r.id} onClick={() => setStatus(r.id, "active")}>
                  Activer
                </Button>
              )}
              {r.account_status === "active" && (
                <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => setStatus(r.id, "suspended")}>
                  Suspendre
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
