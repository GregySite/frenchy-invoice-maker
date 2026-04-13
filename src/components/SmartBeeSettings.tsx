import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function SmartBeeSettings() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleVerifyAndSave = async () => {
    setLoading(true);
    setStatus('idle');
    
    try {
      // 1. Sauvegarde d'abord la clé dans le profil
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      await supabase
        .from("profiles")
        .update({ smartbee_api_key: apiKey })
        .eq("id", user.id);

      // 2. Appel de la fonction de vérification
      const { data, error } = await supabase.functions.invoke('fetch-smartbee', {
        body: { resource: 'check_auth' }
      });

      if (error || !data?.success) {
        setStatus('error');
        toast.error("Échec de la vérification : Clé API invalide");
      } else {
        setStatus('success');
        toast.success("Clé API Smartbee validée et enregistrée !");
      }
    } catch (err: any) {
      setStatus('error');
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Settings className="h-4 w-4 mr-2" />
          Réglages API
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configuration Smartbee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Clé API Smartbee</label>
            <div className="flex gap-2">
              <Input 
                type="password" 
                placeholder="Entrez votre clé..." 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <div className="flex items-center">
                {status === 'success' && <CheckCircle2 className="text-green-500 h-6 w-6 animate-in zoom-in" />}
                {status === 'error' && <XCircle className="text-red-500 h-6 w-6 animate-in zoom-in" />}
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full" 
            onClick={handleVerifyAndSave} 
            disabled={loading || !apiKey}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Vérifier et Enregistrer
          </Button>
          
          <p className="text-[10px] text-muted-foreground text-center">
            Le voyant vert confirme que la connexion avec les serveurs Smartbee est opérationnelle.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
