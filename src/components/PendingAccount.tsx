import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Clock, LogOut, Ban, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  status: "pending" | "suspended";
  onSignOut: () => void;
}

export default function PendingAccount({ status, onSignOut }: Props) {
  const suspended = status === "suspended";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("contact-admin", {
        body: { name: name.trim(), phone: phone.trim(), message: message.trim() },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      toast({
        title: "Envoi impossible",
        description: "Réessayez dans un instant.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-5">
        <div className="flex justify-center">
          {suspended ? (
            <Ban className="h-10 w-10 text-destructive" />
          ) : (
            <Clock className="h-10 w-10 text-invoice-accent" />
          )}
        </div>

        <h1 className="font-display text-xl text-foreground text-center">
          {suspended ? "Votre compte est suspendu" : "Votre compte est en attente d'activation"}
        </h1>

        <p className="text-sm text-muted-foreground text-center">
          {suspended
            ? "Envoyez-nous un message pour réactiver votre accès."
            : "Envoyez-nous un message pour finaliser votre inscription."}
        </p>

        {sent ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-invoice-accent" />
            <p className="text-sm text-foreground">Message envoyé</p>
            <p className="text-xs text-muted-foreground">
              Nous revenons vers vous rapidement.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 text-left">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Nom</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Téléphone (facultatif)</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-message">Message</Label>
              <Textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={4000}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={sending}>
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Envoi…" : "Envoyer"}
            </Button>
          </form>
        )}

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onSignOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Se déconnecter
          </Button>
        </div>
      </div>
    </div>
  );
}
