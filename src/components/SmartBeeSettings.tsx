import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function SmartBeeSettings() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleVerifyAndSave = async () => {
    setLoading(true);
    setStatus('idle');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("profiles").update({ smartbee_api_key: apiKey }).eq("id", user?.id);

      const { data } = await supabase.functions.invoke('fetch-smartbee', { body: { resource: 'check_auth' } });

      if (data?.success) {
        setStatus('success');
        toast.success("Clé Smartbee validée !");
      } else {
        setStatus('error');
        toast.error("Clé rejetée par Smartbee.");
      }
    } catch (err) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2"><Settings className="h-4 w-4 mr-2" />API</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Paramètres Smartbee</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-xs">
            <a href="https://smartbee.co.il/pc/dealer/update-details/updateUser_api_configuration" target="_blank" className="text-blue-600 flex items-center hover:underline">
              Lien vers votre Token Smartbee (הצגת טוקן) <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </div>
          <div className="flex gap-2">
            <Input type="password" placeholder="Votre clé..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <div className="flex items-center">
              {status === 'success' && <CheckCircle2 className="text-green-500 h-6 w-6" />}
              {status === 'error' && <XCircle className="text-red-500 h-6 w-6" />}
            </div>
          </div>
          <Button className="w-full" onClick={handleVerifyAndSave} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Vérifier et Enregistrer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
