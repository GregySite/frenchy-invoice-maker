import { useEffect } from "react";
import { InvoiceData, InvoiceItem } from "@/types/invoice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import ClientSearch from "@/components/ClientSearch";
import { useSmartBeeData, SmartBeeClient } from "@/hooks/useSmartBeeData";

// Seuil légal du numéro d'allocation (הקצאה) — 5 000 ₪ HT depuis le 1er juin 2026
const HAKTZA_THRESHOLD = 5000;

export const DOCUMENT_TYPES = [
  { value: "320", label: "Facture + Reçu", hebrew: "חשבונית קבלה" },
  { value: "305", label: "Facture TVA", hebrew: "חשבונית מס" },
  { value: "400", label: "Reçu", hebrew: "קבלה" },
  { value: "330", label: "Avoir / Crédit", hebrew: "זיכוי" },
  { value: "100", label: "Devis", hebrew: "הצעת מחיר" },
  { value: "200", label: "Bon de commande", hebrew: "הזמנה" },
];

interface InvoiceFormProps {
  data: InvoiceData;
  onChange: (data: InvoiceData) => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="font-display text-lg text-foreground">{title}</h3>
    <div className="grid gap-3">{children}</div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default function InvoiceForm({ data, onChange }: InvoiceFormProps) {
  const set = <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) =>
    onChange({ ...data, [key]: value });

  // Charge les données SmartBee (compte + clients)
  const { account, clients, loading: sbLoading } = useSmartBeeData(true);

  // Pré-remplit l'émetteur depuis le compte SmartBee (une seule fois, si vide)
  useEffect(() => {
    if (!account) return;
    if (data.senderName) return; // déjà rempli, on ne touche pas
    onChange({
      ...data,
      senderName:    account.name    ?? data.senderName,
      senderAddress: account.address ?? data.senderAddress,
      senderPhone:   account.phone   ?? data.senderPhone,
      senderEmail:   account.email   ?? data.senderEmail,
      senderSiret:   account.taxId   ?? data.senderSiret,
    });
  }, [account]);

  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const needsHaktza = data.currency === "₪" && subtotal >= HAKTZA_THRESHOLD;

  const updateItem = (id: string, patch: Partial<InvoiceItem>) => {
    set("items", data.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const addItem = () => {
    set("items", [...data.items, { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (id: string) => {
    if (data.items.length > 1) set("items", data.items.filter((i) => i.id !== id));
  };

  // Quand on sélectionne un client existant depuis SmartBee
  const handleClientSelect = (client: SmartBeeClient) => {
    onChange({
      ...data,
      clientName:    client.name,
      clientAddress: client.address ?? "",
      clientEmail:   client.emails?.[0] ?? "",
    });
  };

  return (
    <div className="space-y-6">

      {/* Type de document */}
      <Section title="Type de document">
        <Field label="Type">
          <Select
            value={data.documentType ?? "320"}
            onValueChange={(v) => set("documentType", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir un type..." />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <span>{t.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">— {t.hebrew}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      {/* Infos facture */}
      <Section title="Informations">
        <div className="grid grid-cols-2 gap-3">
          <Field label="N° de facture">
            <Input placeholder="FAC-001" value={data.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} />
          </Field>
          <Field label="Devise">
            <Select value={data.currency} onValueChange={(v) => set("currency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="₪">₪ Shekel</SelectItem>
                <SelectItem value="€">€ Euro</SelectItem>
                <SelectItem value="$">$ Dollar</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date d'émission">
            <Input type="date" value={data.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Date d'échéance">
            <Input type="date" value={data.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Émetteur — pré-rempli depuis SmartBee */}
      <Section title={sbLoading ? "Émetteur (chargement…)" : "Émetteur"}>
        <Field label="Nom / Société">
          <Input value={data.senderName} onChange={(e) => set("senderName", e.target.value)} />
        </Field>
        <Field label="Adresse">
          <Input value={data.senderAddress} onChange={(e) => set("senderAddress", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone">
            <Input value={data.senderPhone} onChange={(e) => set("senderPhone", e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={data.senderEmail} onChange={(e) => set("senderEmail", e.target.value)} />
          </Field>
        </div>
        <Field label="N° SIRET / ח.פ.">
          <Input value={data.senderSiret} onChange={(e) => set("senderSiret", e.target.value)} />
        </Field>
      </Section>

      {/* Client — avec auto-complétion SmartBee */}
      <Section title="Client">
        <Field label="Nom / Société">
          <ClientSearch
            value={data.clientName}
            onChange={(v) => set("clientName", v)}
            onSelect={handleClientSelect}
            clients={clients}
            placeholder={clients.length > 0 ? `Rechercher parmi ${clients.length} clients…` : "Nom du client"}
          />
        </Field>
        <Field label="Adresse">
          <Input value={data.clientAddress} onChange={(e) => set("clientAddress", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={data.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} />
        </Field>
      </Section>

      {/* Lignes */}
      <Section title="Prestations">
        <div className="space-y-2">
          {data.items.map((item, idx) => (
            <div key={item.id} className="grid grid-cols-[1fr_60px_80px_32px] gap-2 items-end">
              <Field label={idx === 0 ? "Description" : ""}>
                <Input
                  placeholder="Description du service"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                />
              </Field>
              <Field label={idx === 0 ? "Qté" : ""}>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                />
              </Field>
              <Field label={idx === 0 ? "Prix unit." : ""}>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })}
                />
              </Field>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(item.id)}
                disabled={data.items.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={addItem} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Ajouter une ligne
        </Button>
      </Section>

      {/* TVA */}
      <Section title="TVA">
        <Field label="Taux de TVA (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={data.vatRate}
            onChange={(e) => set("vatRate", Number(e.target.value))}
          />
        </Field>
      </Section>

      {/* Haktza'a warning */}
      {needsHaktza && (
        <div className="flex items-start gap-2.5 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">מספר הקצאה נדרש</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Facture HT ≥ 5 000 ₪ — un numéro d'allocation (הקצאה) sera automatiquement demandé via la plateforme choisie.
            </p>
          </div>
        </div>
      )}

      {/* Notes */}
      <Section title="Notes">
        <Textarea
          placeholder="Conditions de paiement, remarques..."
          value={data.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
        />
      </Section>
    </div>
  );
}
