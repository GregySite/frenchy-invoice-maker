import { useState } from "react";
import { InvoiceData } from "@/types/invoice";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const providers = [
  {
    id: "greeninvoice" as const,
    name: "Green Invoice (Morning)",
    description: "חשבונית ירוקה / מורנינג",
    color: "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60",
    icon: "🌿",
  },
  {
    id: "invoice4u" as const,
    name: "Invoice4U",
    description: "הפקת חשבוניות אונליין",
    color: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/60",
    icon: "📄",
  },
  {
    id: "icount" as const,
    name: "iCount",
    description: "הנהלת חשבונות בענן",
    color: "bg-orange-500/10 border-orange-500/30 hover:border-orange-500/60",
    icon: "📊",
  },
  {
    id: "invoicemaven" as const,
    name: "Invoice Maven",
    description: "חשבונית מס וקבלות",
    color: "bg-purple-500/10 border-purple-500/30 hover:border-purple-500/60",
    icon: "🧾",
  },
];

type ProviderID = (typeof providers)[number]["id"];

interface ExportDialogProps {
  invoice: InvoiceData;
}

export default function ExportDialog({ invoice }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ProviderID | null>(null);

  const handleExport = async (providerId: ProviderID) => {
    setLoading(providerId);
    try {
      const { data, error } = await supabase.functions.invoke("export-invoice", {
        body: { provider: providerId, invoice },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Facture exportée vers ${providers.find((p) => p.id === providerId)?.name}`, {
        icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
      });
      setOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Échec de l'export : ${message}`, {
        icon: <AlertCircle className="h-4 w-4 text-destructive" />,
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-invoice-accent/30 text-invoice-accent hover:bg-invoice-accent/10 h-8 px-2 sm:px-3 text-xs sm:text-sm">
          <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
          <span className="hidden sm:inline">Exporter</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Exporter la facture</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Choisissez la plateforme vers laquelle envoyer cette facture.
        </p>
        <div className="grid gap-3">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => handleExport(p.id)}
              disabled={loading !== null}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${p.color} disabled:opacity-50`}
            >
              <span className="text-2xl">{p.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.description}</p>
              </div>
              {loading === p.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
