import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { InvoiceData, defaultInvoice } from "@/types/invoice";
import InvoiceForm from "@/components/InvoiceForm";
import InvoicePreview from "@/components/InvoicePreview";
import { FileText, Eye, LogOut, ShieldCheck } from "lucide-react";
import ExportButton from "@/components/ExportButton";
import ProviderSettings from "@/components/ProviderSettings";
import AuthForm from "@/components/AuthForm";
import PendingAccount from "@/components/PendingAccount";
import { useAuth } from "@/hooks/useAuth";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { Button } from "@/components/ui/button";
import InvoiceHistory from "@/components/InvoiceHistory";

export default function Index() {
  const { user, loading, signOut } = useAuth();
  const { status, isAdmin, loading: statusLoading } = useAccountStatus(user?.id);
  const [invoice, setInvoice] = useState<InvoiceData>(defaultInvoice);
  const [view, setView] = useState<"form" | "preview">("form");
  const [historyKey, setHistoryKey] = useState(0);
  const [providersKey, setProvidersKey] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);

  if (loading || (user && statusLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <FileText className="h-8 w-8 text-invoice-accent animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  if (status !== "active" && !isAdmin) {
    return <PendingAccount status={status === "suspended" ? "suspended" : "pending"} onSignOut={signOut} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-4 h-12 sm:h-14">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-invoice-accent shrink-0" />
            <span className="font-display text-sm sm:text-lg text-foreground truncate">Ma Compta Link</span>
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
            <ExportButton
              invoice={invoice}
              refreshKey={providersKey}
              onExported={() => setHistoryKey((k) => k + 1)}
            />
            <ProviderSettings onChanged={() => setProvidersKey((k) => k + 1)} />
            {isAdmin && (
              <Link to="/admin" className="text-muted-foreground hover:text-foreground p-2" title="Administration">
                <ShieldCheck className="h-4 w-4" />
              </Link>
            )}
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

      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Greg u.
      </footer>
    </div>
  );
}
