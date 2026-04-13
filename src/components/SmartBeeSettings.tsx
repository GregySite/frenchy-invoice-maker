import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");

      // 1. Sauvegarde dans Supabase
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ smartbee_api_key: apiKey })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // 2. Test de connexion via la Edge Function
      const { data, error } = await supabase.functions.invoke('fetch-smartbee', {
        body: { resource: 'check_auth' }
      });

      if (error || !data?.success) {
        setStatus('error');
        toast.error("Smartbee refuse la clé. Vérifiez qu'il n'y a pas d'espace en trop.");
      } else {
        setStatus('success');
        toast.success("Connexion établie avec Smartbee !");
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
          Configuration API
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Paramètres Smartbee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
            <p className="text-xs text-blue-800 mb-2">
              Récupérez votre clé sur votre interface Smartbee :
            </p>
            <a 
              href="https://smartbee.co.il/pc/dealer/update-details/updateUser_api_configuration" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs font-medium text-blue-600 flex items-center hover:underline"
            >
              Aller aux réglages API Smartbee (puis "הצגת טוקן")
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Votre clé API (Token)</label>
            <div className="flex gap-2">
              <Input 
                type="password" 
                placeholder="Collez votre jeton ici..." 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={status === 'error' ? "border-red-500" : status === 'success' ? "border-green-500" : ""}
              />
              <div className="flex items-center px-1">
                {status === 'success' && <CheckCircle2 className="text-green-500 h-6 w-6" />}
                {status === 'error' && <XCircle className="text-red-500 h-6 w-6" />}
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full" 
            onClick={handleVerifyAndSave} 
            disabled={loading || !apiKey}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Vérifier et Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
