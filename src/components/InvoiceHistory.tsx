import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InvoiceData } from "@/types/invoice";
import { History, ChevronDown, ChevronUp } from "lucide-react";

interface InvoiceRow {
  id: string;
  invoice_number: string;
  date: string;
  client_name: string | null;
  platform: string;
  platform_status: string;
  items: unknown;
  vat_rate: number;
  currency: string;
  notes: string | null;
  due_date: string | null;
  sender_name: string | null;
  sender_address: string | null;
  sender_phone: string | null;
  sender_email: string | null;
  sender_siret: string | null;
  client_address: string | null;
  client_email: string | null;
  created_at: string;
}

const platformLabels: Record<string, string> = {
  greeninvoice: "Green Invoice",
  invoice4u: "Invoice4U",
  icount: "iCount",
  invoicemaven: "Invoice Maven",
};

interface Props {
  onSelect: (data: InvoiceData) => void;
}

export default function InvoiceHistory({ onSelect }: Props) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setInvoices(data as unknown as InvoiceRow[]);
    };
    load();
  }, []);

  if (invoices.length === 0) return null;

  const rowToInvoice = (row: InvoiceRow): InvoiceData => ({
    invoiceNumber: row.invoice_number,
    date: row.date,
    dueDate: row.due_date || "",
    documentType: "320",
    senderName: row.sender_name || "",
    senderAddress: row.sender_address || "",
    senderPhone: row.sender_phone || "",
    senderEmail: row.sender_email || "",
    senderSiret: row.sender_siret || "",
    clientName: row.client_name || "",
    clientAddress: row.client_address || "",
    clientEmail: row.client_email || "",
    items: Array.isArray(row.items) ? (row.items as InvoiceData["items"]) : [],
    vatRate: row.vat_rate,
    notes: row.notes || "",
    currency: row.currency,
  });

  return (
    <div className="bg-card rounded-lg border border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
      >
        <span className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Historique ({invoices.length})
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border max-h-60 overflow-y-auto">
          {invoices.map((inv) => (
            <button
              key={inv.id}
              onClick={() => onSelect(rowToInvoice(inv))}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
            >
              <div className="flex justify-between items-center">
                <span className="font-medium truncate">{inv.invoice_number}</span>
                <span className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="flex justify-between items-center mt-0.5">
                <span className="text-xs text-muted-foreground truncate">{inv.client_name || "—"}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${inv.platform_status === "exported" ? "bg-emerald-500/10 text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                  {platformLabels[inv.platform] || inv.platform}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
