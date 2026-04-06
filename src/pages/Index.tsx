import { useRef, useState } from "react";
import { InvoiceData, defaultInvoice } from "@/types/invoice";
import InvoiceForm from "@/components/InvoiceForm";
import InvoicePreview from "@/components/InvoicePreview";
import { Button } from "@/components/ui/button";
import { Download, FileText, Eye } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function Index() {
  const [invoice, setInvoice] = useState<InvoiceData>(defaultInvoice);
  const [view, setView] = useState<"form" | "preview">("form");
  const previewRef = useRef<HTMLDivElement>(null);

  const downloadPDF = async () => {
    if (!previewRef.current) return;
    const canvas = await html2canvas(previewRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    pdf.save(`facture-${invoice.invoiceNumber || "brouillon"}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-invoice-accent" />
            <span className="font-display text-lg text-foreground">FacturePro</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile toggle */}
            <div className="flex lg:hidden border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setView("form")}
                className={`px-3 py-1.5 text-sm ${view === "form" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Formulaire
              </button>
              <button
                onClick={() => setView("preview")}
                className={`px-3 py-1.5 text-sm ${view === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={downloadPDF} size="sm" className="bg-invoice-accent text-foreground hover:opacity-90">
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
          {/* Form */}
          <aside className={`${view === "preview" ? "hidden lg:block" : ""} overflow-y-auto`}>
            <div className="bg-card rounded-lg border border-border p-5">
              <InvoiceForm data={invoice} onChange={setInvoice} />
            </div>
          </aside>

          {/* Preview */}
          <main className={`${view === "form" ? "hidden lg:flex" : "flex"} justify-center`}>
            <InvoicePreview ref={previewRef} data={invoice} />
          </main>
        </div>
      </div>
    </div>
  );
}
