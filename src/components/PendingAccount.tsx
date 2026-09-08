import { Button } from "@/components/ui/button";
import { Clock, Mail, Phone, LogOut, Ban } from "lucide-react";

export const CONTACT_EMAIL = "gregory.uzan@gmail.com";
export const CONTACT_PHONE = "054-357-0160";

interface Props {
  status: "pending" | "suspended";
  onSignOut: () => void;
}

export default function PendingAccount({ status, onSignOut }: Props) {
  const suspended = status === "suspended";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-5 text-center">
        <div className="flex justify-center">
          {suspended ? (
            <Ban className="h-10 w-10 text-destructive" />
          ) : (
            <Clock className="h-10 w-10 text-invoice-accent" />
          )}
        </div>

        <h1 className="font-display text-xl text-foreground">
          {suspended ? "Votre compte est suspendu" : "Votre compte est en attente d'activation"}
        </h1>

        <p className="text-sm text-muted-foreground">
          {suspended
            ? "Contactez-nous pour réactiver votre accès."
            : "Contactez-nous pour finaliser votre inscription."}
        </p>

        <div className="space-y-2 text-sm">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-center justify-center gap-2 text-invoice-accent hover:underline"
          >
            <Mail className="h-4 w-4" /> {CONTACT_EMAIL}
          </a>
          <a
            href={`tel:${CONTACT_PHONE.replace(/[^0-9+]/g, "")}`}
            className="flex items-center justify-center gap-2 text-invoice-accent hover:underline"
          >
            <Phone className="h-4 w-4" /> {CONTACT_PHONE}
          </a>
        </div>

        <Button variant="ghost" size="sm" onClick={onSignOut} className="text-muted-foreground">
          <LogOut className="h-4 w-4 mr-2" /> Se déconnecter
        </Button>
      </div>
    </div>
  );
}
