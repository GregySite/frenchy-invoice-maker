import { useRef, useState } from "react";
import { InvoiceData, defaultInvoice } from "@/types/invoice";
import InvoiceForm from "@/components/InvoiceForm";
import InvoicePreview from "@/components/InvoicePreview";
import { FileText, Eye, LogOut } from "lucide-react";
import ExportDialog from "@/components/ExportDialog";
import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import InvoiceHistory from "@/components/InvoiceHistory";

export default function Index() {
  const { user, loading, signOut } = useAuth();
  const [invoice, setInvoice] = useState<InvoiceData>(defaultInvoice);
  const [view, setView] = useState<"form" | "preview">("form");
  const [historyKey, setHistoryKey] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <FileText className="h-8 w-8 text-invoice-accent animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-4 h-12 sm:h-14">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-invoice-accent shrink-0" />
            <span className="font-display text-sm sm:text-lg text-foreground truncate">FacturePro</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile toggle */}
            <div className="flex lg:hidden border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setView("form")}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm ${view === "form" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Form
              </button>
              <button
                onClick={() => setView("preview")}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm ${view === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
            <ExportDialog invoice={invoice} onExported={() => setHistoryKey((k) => k + 1)} />
            <Button
              onClick={signOut}
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
          {/* Form */}
          <aside className={`${view === "preview" ? "hidden lg:block" : ""} overflow-y-auto space-y-4`}>
            <div className="bg-card rounded-lg border border-border p-5">
              <InvoiceForm data={invoice} onChange={setInvoice} />
            </div>
            <InvoiceHistory key={historyKey} onSelect={setInvoice} />
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
