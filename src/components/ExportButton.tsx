import { useState } from "react";
import { InvoiceData } from "@/types/invoice";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps {
  invoice: InvoiceData;
  onExported?: () => void;
}

export default function ExportButton({ invoice, onExported }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-invoice", {
        body: { provider: "greeninvoice", invoice },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Save to DB
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("invoices").insert({
          user_id: user.id,
          invoice_number: invoice.invoiceNumber || "BROUILLON",
          date: invoice.date,
          due_date: invoice.dueDate || null,
          sender_name: invoice.senderName,
          sender_address: invoice.senderAddress,
          sender_phone: invoice.senderPhone,
          sender_email: invoice.senderEmail,
          sender_siret: invoice.senderSiret,
          client_name: invoice.clientName,
          client_address: invoice.clientAddress,
          client_email: invoice.clientEmail,
          items: JSON.parse(JSON.stringify(invoice.items)),
          vat_rate: invoice.vatRate,
          notes: invoice.notes,
          currency: invoice.currency,
          platform: "smartbee",
          platform_status: "exported",
        });
      }

      toast.success("Facture envoyée sur SmartBee 🐝");
      onExported?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Échec de l'envoi : ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="bg-invoice-accent text-foreground hover:opacity-90 h-8 px-2 sm:px-3 text-xs sm:text-sm"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 animate-spin" />
      ) : (
        <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
      )}
      <span className="hidden sm:inline">Envoyer</span>
    </Button>
  );
}
