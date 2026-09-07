import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, CheckCircle2, XCircle, Loader2, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PROVIDERS } from "@/lib/providers";
import { useProviderCredentials } from "@/hooks/useProviderCredentials";

interface Props {
  onChanged?: () => void;
}

export default function ProviderSettings({ onChanged }: Props) {
  const { rows, defaultProvider, reload } = useProviderCredentials();
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, Record<string, string>> = {};
    rows.forEach((r) => (next[r.provider] = { ...r.credentials }));
    setValues((v) => ({ ...next, ...v }));
  }, [rows]);

  const statusOf = (id: string) => rows.find((r) => r.provider === id);

  const saveAndTest = async (providerId: string) => {
    const creds = values[providerId] ?? {};
    const meta = PROVIDERS.find((p) => p.id === providerId)!;
    if (meta.fields.some((f) => !creds[f.key]?.trim())) {
      toast.error("Remplissez tous les champs de cette plateforme.");
      return;
    }
    setBusy(providerId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const trimmed = Object.fromEntries(Object.entries(creds).map(([k, v]) => [k, v.trim()]));
      const isFirst = rows.filter((r) => Object.keys(r.credentials).length > 0).length === 0;

      const { error: upsertError } = await supabase.from("provider_credentials").upsert(
        {
          user_id: user.id,
          provider: providerId,
          credentials: trimmed,
          is_default: isFirst || defaultProvider === providerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );
      if (upsertError) throw upsertError;

      const { data, error } = await supabase.functions.invoke("verify-provider", {
        body: { provider: providerId },
      });
      if (error) throw error;

      if (data?.success) toast.success(`${meta.label} : connexion réussie`);
      else toast.error(`${meta.label} : ${data?.error ?? "identifiants refusés"}`);

      await reload();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const makeDefault = async (providerId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("provider_credentials").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("provider_credentials").update({ is_default: true }).eq("user_id", user.id).eq("provider", providerId);
    await reload();
    onChanged?.();
    toast.success("Plateforme par défaut mise à jour");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Settings className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Plateformes</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mes plateformes de facturation</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Connectez un ou plusieurs comptes. Vos factures seront créées directement sur la plateforme choisie.
        </p>

        <div className="space-y-4 py-2">
          {PROVIDERS.map((p) => {
            const st = statusOf(p.id);
            const saved = st && Object.keys(st.credentials).length > 0;
            return (
              <div key={p.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span>{p.emoji}</span>
                    <span className="font-medium text-sm truncate">{p.label}</span>
                    {saved && st?.last_check_ok === true && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                    {saved && st?.last_check_ok === false && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  </div>
                  {saved && (
                    <button
                      onClick={() => makeDefault(p.id)}
                      className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Star className={`h-3.5 w-3.5 ${defaultProvider === p.id ? "fill-invoice-accent text-invoice-accent" : ""}`} />
                      {defaultProvider === p.id ? "Par défaut" : "Définir par défaut"}
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">{p.help}</p>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noreferrer" className="text-xs text-invoice-accent inline-flex items-center hover:underline">
                    Ouvrir {p.label} <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                )}

                <div className="grid gap-2">
                  {p.fields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{f.label}</Label>
                      <Input
                        type={f.type ?? "text"}
                        autoComplete="off"
                        value={values[p.id]?.[f.key] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [p.id]: { ...(v[p.id] ?? {}), [f.key]: e.target.value } }))
                        }
                      />
                    </div>
                  ))}
                </div>

                {st?.last_check_ok === false && st.last_check_error && (
                  <p className="text-xs text-destructive break-words">{st.last_check_error}</p>
                )}

                <Button size="sm" className="w-full" onClick={() => saveAndTest(p.id)} disabled={busy === p.id}>
                  {busy === p.id && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                  Enregistrer et tester
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
