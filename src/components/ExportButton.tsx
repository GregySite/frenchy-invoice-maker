import { useEffect, useState } from "react";
import { InvoiceData } from "@/types/invoice";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProviderCredentials } from "@/hooks/useProviderCredentials";
import { providerEmoji, providerLabel } from "@/lib/providers";

interface ExportButtonProps {
  invoice: InvoiceData;
  onExported?: () => void;
  refreshKey?: number;
}

export default function ExportButton({ invoice, onExported, refreshKey }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const { connected, defaultProvider, reload } = useProviderCredentials();
  const [provider, setProvider] = useState<string>("");

  useEffect(() => {
    void reload();
  }, [refreshKey, reload]);

  useEffect(() => {
    if (!provider && defaultProvider) setProvider(defaultProvider);
  }, [defaultProvider, provider]);

  const handleExport = async () => {
    if (!provider) {
      toast.error("Connectez d'abord une plateforme dans « Plateformes ».");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-invoice", {
        body: { provider, invoice },
      });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      const base = {
        user_id: user!.id,
        invoice_number: invoice.invoiceNumber || "BROUILLON",
        date: invoice.date,
        due_date: invoice.dueDate || null,
        document_type: invoice.documentType,
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
        platform: provider,
      };

      if (!data?.success) {
        const rawMessage = data?.error ?? "La plateforme a refusé la facture";
        const withStatus = data?.status ? `[${data.status}] ${rawMessage}` : rawMessage;
        if (user) {
          await supabase.from("invoices").insert({ ...base, platform_status: "failed", error_message: withStatus });
        }
        onExported?.();
        throw new Error(withStatus);
      }

      if (user) {
        await supabase.from("invoices").insert({
          ...base,
          platform_status: "exported",
          external_id: data.externalId,
          external_number: data.externalNumber,
          pdf_url: data.pdfUrl,
        });
      }

      toast.success(`Facture créée sur ${providerLabel(provider)}`, {
        description: data.externalNumber ? `N° ${data.externalNumber}` : undefined,
        action: data.pdfUrl
          ? { label: "Ouvrir le PDF", onClick: () => window.open(data.pdfUrl, "_blank") }
          : undefined,
      });
      onExported?.();
    } catch (err: unknown) {
      // Toast prolongé pendant la phase de tests réels avec les plateformes,
      // pour laisser le temps de lire le message brut renvoyé par l'API.
      toast.error(err instanceof Error ? err.message : "Erreur inconnue", { duration: 15000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {connected.length > 1 && (
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="h-8 w-[110px] sm:w-[150px] text-xs">
            <SelectValue placeholder="Plateforme" />
          </SelectTrigger>
          <SelectContent>
            {connected.map((c) => (
              <SelectItem key={c.provider} value={c.provider}>
                {providerEmoji(c.provider)} {providerLabel(c.provider)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        size="sm"
        onClick={handleExport}
        disabled={loading || connected.length === 0}
        className="bg-invoice-accent text-foreground hover:opacity-90 h-8 px-2 sm:px-3 text-xs sm:text-sm"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
        )}
        <span className="hidden sm:inline">Envoyer</span>
      </Button>
    </div>
  );
}
