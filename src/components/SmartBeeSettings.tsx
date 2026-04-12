import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings, Loader2, Check, Eye, EyeOff, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function SmartBeeSettings() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [connected, setConnected] = useState(false);
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);

  const hydrateFromProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setApiKey("");
        setHasSavedApiKey(false);
        setConnected(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("smartbee_api_key, smartbee_connected")
        .eq("id", user.id)
        .single() as { data: { smartbee_api_key?: string | null; smartbee_connected?: boolean | null } | null };

      const storedKey = data?.smartbee_api_key?.trim() ?? "";
      setApiKey(storedKey);
      setHasSavedApiKey(Boolean(storedKey));
      setConnected(Boolean(data?.smartbee_connected));
    } catch {
      // ignore
    }
  };

  // Hydrate uniquement l'état local pour éviter des vérifications API inutiles
  useEffect(() => {
    void hydrateFromProfile();
  }, []);

  // Charge les credentials quand le dialog s'ouvre
  useEffect(() => {
    if (open) loadKeys();
  }, [open]);

  const loadKeys = async () => {
    setLoading(true);
    try {
      await hydrateFromProfile();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("Veuillez renseigner votre clé API");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const { error: saveError } = await (supabase
        .from("profiles") as any)
        .update({
          smartbee_api_key: apiKey.trim(),
          smartbee_connected: false,
        })
        .eq("id", user.id);
      if (saveError) throw saveError;

      setApiKey(apiKey.trim());
      setHasSavedApiKey(true);
      setConnected(false);
      toast.success("Clé API SmartBee enregistrée ✓");
      setOpen(false);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-muted-foreground hover:text-foreground relative"
          title="Paramètres SmartBee"
        >
          <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {connected ? (
            <Check className="h-2.5 w-2.5 text-green-500 absolute -top-0.5 -right-0.5" />
          ) : hasSavedApiKey ? (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-invoice-accent" />
          ) : (
            <X className="h-2.5 w-2.5 text-red-400 absolute -top-0.5 -right-0.5" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-invoice-accent" />
            Configurer SmartBee
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">

            {/* Statut actuel */}
            {connected ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm text-emerald-400">
                <Check className="h-4 w-4 shrink-0" />
                Clé API SmartBee enregistrée
              </div>
            ) : hasSavedApiKey ? (
              <div className="flex items-center gap-2 rounded-lg border border-invoice-accent/20 bg-invoice-accent/10 px-3 py-2 text-sm text-foreground">
                <Settings className="h-4 w-4 shrink-0 text-invoice-accent" />
                Clé API enregistrée — vérification automatique désactivée pour éviter de consommer du crédit
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                <X className="h-4 w-4 shrink-0" />
                Aucune clé API enregistrée — renseignez-la ci-dessous
              </div>
            )}

            {/* Instructions */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Comment trouver votre clé API :</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Connectez-vous sur SmartBee (Green Invoice)</li>
                <li>Allez dans <span className="font-medium text-foreground">Paramètres → Outils développeur → Clés API</span></li>
                <li>Créez une nouvelle clé API</li>
                <li>Copiez la <span className="font-medium text-foreground">clé API</span> ci-dessous</li>
              </ol>
              <a
                href="https://smartbee.co.il/pc/dealer/update-details/updateUser_api_configuration"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-invoice-accent hover:underline mt-1"
              >
                Ouvrir SmartBee <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Clé API */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Clé API</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Votre clé API SmartBee"
                  className="pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-invoice-accent text-foreground hover:opacity-90"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                "Enregistrer ma clé API"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
