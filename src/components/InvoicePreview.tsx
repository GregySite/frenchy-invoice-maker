import { forwardRef } from "react";
import { InvoiceData } from "@/types/invoice";

interface Props {
  data: InvoiceData;
}

const fmt = (n: number, currency: string) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const fmtDate = (d: string) => {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

const InvoicePreview = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = subtotal * (data.vatRate / 100);
  const total = subtotal + vat;

  return (
    <div
      ref={ref}
      className="bg-card text-card-foreground shadow-lg rounded-lg overflow-hidden"
      style={{ width: "100%", maxWidth: 595, fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="bg-invoice-header text-invoice-header-foreground px-8 py-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-display text-3xl tracking-tight">FACTURE</h1>
            <p className="text-sm opacity-80 mt-1">{data.invoiceNumber || "—"}</p>
          </div>
          <div className="text-right text-sm space-y-0.5">
            <p>Date : {fmtDate(data.date)}</p>
            <p>Échéance : {fmtDate(data.dueDate)}</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Parties */}
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Émetteur</p>
            <p className="font-semibold">{data.senderName || "—"}</p>
            <p className="text-muted-foreground whitespace-pre-line">{data.senderAddress}</p>
            {data.senderPhone && <p className="text-muted-foreground">{data.senderPhone}</p>}
            {data.senderEmail && <p className="text-muted-foreground">{data.senderEmail}</p>}
            {data.senderSiret && <p className="text-muted-foreground mt-1">N° {data.senderSiret}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Facturé à</p>
            <p className="font-semibold">{data.clientName || "—"}</p>
            <p className="text-muted-foreground whitespace-pre-line">{data.clientAddress}</p>
            {data.clientEmail && <p className="text-muted-foreground">{data.clientEmail}</p>}
          </div>
        </div>

        {/* Tableau */}
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary text-secondary-foreground">
                <th className="text-left px-4 py-2 font-medium">Description</th>
                <th className="text-right px-4 py-2 font-medium w-16">Qté</th>
                <th className="text-right px-4 py-2 font-medium w-24">P.U.</th>
                <th className="text-right px-4 py-2 font-medium w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 1 ? "bg-muted/40" : ""}>
                  <td className="px-4 py-2">{item.description || "—"}</td>
                  <td className="px-4 py-2 text-right">{item.quantity}</td>
                  <td className="px-4 py-2 text-right">{fmt(item.unitPrice, data.currency)}</td>
                  <td className="px-4 py-2 text-right">{fmt(item.quantity * item.unitPrice, data.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totaux */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sous-total</span>
              <span>{fmt(subtotal, data.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TVA ({data.vatRate}%)</span>
              <span>{fmt(vat, data.currency)}</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between text-base font-semibold">
              <span>Total TTC</span>
              <span className="text-invoice-accent">{fmt(total, data.currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {data.notes && (
          <div className="text-sm text-muted-foreground border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1">Notes</p>
            <p className="whitespace-pre-line">{data.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
});

InvoicePreview.displayName = "InvoicePreview";
export default InvoicePreview;
