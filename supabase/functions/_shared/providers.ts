// Adaptateurs pour les plateformes de facturation israéliennes.
// Chaque adaptateur sait : vérifier des identifiants + créer un document comptable.

export type ProviderId = "smartbee" | "greeninvoice" | "invoice4u" | "icount" | "invoicemaven";

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceInput {
  invoiceNumber?: string;
  documentType?: string; // codes Green Invoice : 320 facture-reçu, 305 facture, 400 reçu, 330 avoir, 10 devis, 100 commande
  date?: string;
  dueDate?: string;
  currency?: string; // ₪ € $
  vatRate?: number;
  notes?: string;
  clientName?: string;
  clientAddress?: string;
  clientEmail?: string;
  items: InvoiceItemInput[];
}

export interface ProviderResult {
  ok: boolean;
  status: number;
  externalId?: string;
  externalNumber?: string;
  pdfUrl?: string;
  error?: string;
  raw?: unknown;
}

export const CURRENCY_CODES: Record<string, string> = { "₪": "ILS", "€": "EUR", "$": "USD" };

export function currencyCode(symbol?: string) {
  return CURRENCY_CODES[symbol ?? "₪"] ?? "ILS";
}

export function totals(invoice: InvoiceInput) {
  const subtotal = invoice.items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);
  const vat = subtotal * (Number(invoice.vatRate ?? 0) / 100);
  return { subtotal, vat, total: subtotal + vat };
}

async function readBody(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function fail(status: number, body: unknown): ProviderResult {
  const error =
    typeof body === "string"
      ? body.slice(0, 500)
      : ((body as Record<string, unknown>)?.errorMessage as string) ??
        ((body as Record<string, unknown>)?.error_description as string) ??
        ((body as Record<string, unknown>)?.status_description as string) ??
        JSON.stringify(body).slice(0, 500);
  return { ok: false, status, error, raw: body };
}

/* ------------------------------------------------------------------ */
/* SmartBee (smartbee.co.il) — clé API unique envoyée dans le body      */
/* ⚠️ SmartBee annonce un "API ouvert" (limite 600 documents/mois en    */
/* génération automatique) mais aucune documentation publique complète  */
/* n'a été trouvée. Le format ci-dessous est une supposition basée sur  */
/* le pattern des autres plateformes — contacter le support SmartBee    */
/* pour la vraie doc + des identifiants de test avant le premier envoi. */
/* ------------------------------------------------------------------ */

const SMARTBEE_BASE = Deno.env.get("SMARTBEE_BASE_URL") ?? "https://smartbee.co.il/api/v1";

async function smartbeeCall(apiKey: string, path: string, payload: Record<string, unknown> = {}) {
  const res = await fetch(`${SMARTBEE_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({ apiKey, ...payload }),
  });
  return { res, body: await readBody(res) };
}

const smartbee = {
  async verify(creds: Record<string, string>): Promise<ProviderResult> {
    if (!creds.apiKey) return { ok: false, status: 400, error: "Clé API manquante" };
    const { res, body } = await smartbeeCall(creds.apiKey, "/user/me");
    return res.ok ? { ok: true, status: res.status, raw: body } : fail(res.status, body);
  },
  async create(creds: Record<string, string>, invoice: InvoiceInput): Promise<ProviderResult> {
    const { vat } = totals(invoice);
    const payload = {
      type: Number(invoice.documentType ?? 320),
      lang: "he",
      currency: currencyCode(invoice.currency),
      vatType: 0,
      description: invoice.notes ?? "",
      remarks: invoice.notes ?? "",
      client: {
        name: invoice.clientName ?? "",
        emails: invoice.clientEmail ? [invoice.clientEmail] : [],
        address: invoice.clientAddress ?? "",
        add: true,
      },
      income: invoice.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity || 0),
        price: Number(i.unitPrice || 0),
        currency: currencyCode(invoice.currency),
        vatType: 0,
      })),
      vat,
    };
    const { res, body } = await smartbeeCall(creds.apiKey, "/documents", payload);
    if (!res.ok) return fail(res.status, body);
    const b = body as Record<string, string>;
    return { ok: true, status: res.status, externalId: b?.id, externalNumber: b?.number, pdfUrl: b?.url ?? b?.pdfUrl, raw: body };
  },
};

/* ------------------------------------------------------------------ */
/* Green Invoice / Morning — OAuth client_credentials                   */
/* ------------------------------------------------------------------ */

const GI_BASE_PROD = "https://api.greeninvoice.co.il/api/v1";
const GI_BASE_SANDBOX = "https://sandbox.d.greeninvoice.co.il/api/v1";

// Le mode test est choisi par l'utilisateur dans Plateformes -> Green Invoice -> "Mode test"
function giBase(creds: Record<string, string>) {
  return creds.sandbox === "true" ? GI_BASE_SANDBOX : GI_BASE_PROD;
}

async function giToken(creds: Record<string, string>) {
  const res = await fetch(`${giBase(creds)}/account/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: creds.apiKeyId, secret: creds.apiKeySecret }),
  });
  const body = await readBody(res);
  if (!res.ok) throw new Error(`[${res.status}] ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return (body as Record<string, string>).token;
}

const greeninvoice = {
  async verify(creds: Record<string, string>): Promise<ProviderResult> {
    if (!creds.apiKeyId || !creds.apiKeySecret) return { ok: false, status: 400, error: "ID et Secret requis" };
    try {
      await giToken(creds);
      return { ok: true, status: 200 };
    } catch (e) {
      return { ok: false, status: 401, error: (e as Error).message };
    }
  },
  async create(creds: Record<string, string>, invoice: InvoiceInput): Promise<ProviderResult> {
    let token: string;
    try {
      token = await giToken(creds);
    } catch (e) {
      return { ok: false, status: 401, error: (e as Error).message };
    }
    const type = Number(invoice.documentType ?? 320);
    const cur = currencyCode(invoice.currency);
    const { total } = totals(invoice);
    const today = new Date().toISOString().slice(0, 10);

    const payload: Record<string, unknown> = {
      type,
      lang: "he",
      currency: cur,
      vatType: 0, // 0 = TVA appliquée selon le type d'entreprise (défaut Green Invoice)
      remarks: invoice.notes ?? "",
      signed: true,
      client: {
        name: invoice.clientName ?? "",
        emails: invoice.clientEmail ? [invoice.clientEmail] : [],
        address: invoice.clientAddress ?? "",
        add: true,
      },
    };
    if (invoice.date) payload.date = invoice.date;
    if (invoice.dueDate) payload.dueDate = invoice.dueDate;
    // Un reçu (400) ne porte que des paiements ; les autres types portent des lignes
    if (type !== 400) {
      payload.income = invoice.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity || 0),
        price: Number(i.unitPrice || 0),
        currency: cur,
        vatType: 0,
      }));
    }
    // Facture-reçu (320) et reçu (400) exigent un tableau "payment" ; le formulaire ne
    // collecte pas encore le mode de paiement -> virement (type 4) par défaut, montant TTC.
    if (type === 320 || type === 400) {
      payload.payment = [{ date: invoice.date || today, type: 4, price: Number(total.toFixed(2)), currency: cur }];
    }

    const res = await fetch(`${giBase(creds)}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const body = await readBody(res);
    if (!res.ok) return fail(res.status, body);
    const b = body as Record<string, unknown>;
    const url = b?.url as Record<string, string> | string | undefined;
    const links = (b?.files as Record<string, unknown> | undefined)?.downloadLinks as Record<string, string> | undefined;
    const pdfUrl = typeof url === "string" ? url : url?.origin ?? links?.he ?? links?.en;
    return { ok: true, status: res.status, externalId: b?.id != null ? String(b.id) : undefined, externalNumber: b?.number != null ? String(b.number) : undefined, pdfUrl, raw: body };
  },
};

/* ------------------------------------------------------------------ */
/* Invoice4U — clé API (GUID) + JSON "WCF wrapped-request"              */
/* Source : spec OpenAPI officielle                                     */
/* github.com/invoice4udev-hue/i4u-docs/openapi/invoice4u-openapi.json  */
/* - POST {base}/{Opération} avec body JSON { ...params, token }        */
/* - réponse enveloppée dans "{Opération}Result", erreurs dans .Errors  */
/* - le login email/mot de passe n'est PLUS accepté : clé API seulement */
/* - environnement QA (sandbox) : apiqa.invoice4u.co.il                 */
/* ------------------------------------------------------------------ */

const I4U_BASE_PROD = "https://api.invoice4u.co.il/Services/ApiService.svc";
const I4U_BASE_QA = "https://apiqa.invoice4u.co.il/Services/ApiService.svc";

function i4uBase(creds: Record<string, string>) {
  return creds.sandbox === "true" ? I4U_BASE_QA : I4U_BASE_PROD;
}

// Nos codes internes (Green Invoice/SmartBee) -> types Invoice4U
// 1 Invoice, 2 Receipt, 3 InvoiceReceipt, 4 InvoiceCredit, 6 InvoiceOrder, 7 InvoiceQuote
function i4uDocType(documentType?: string): number {
  const map: Record<string, number> = { "320": 3, "305": 1, "400": 2, "330": 4, "10": 7, "100": 6 };
  return map[documentType ?? "320"] ?? 3;
}

interface I4UError { ID?: number; Error?: string; Paramters?: string | null }

function i4uErrors(result: unknown): string | null {
  const errs = (result as { Errors?: I4UError[] } | null)?.Errors;
  if (!Array.isArray(errs) || errs.length === 0) return null;
  return errs
    .map((e) => `${e.Error ?? "Erreur"}${e.ID != null ? ` (${e.ID})` : ""}${e.Paramters ? ` – ${e.Paramters}` : ""}`)
    .join(" ; ");
}

async function i4uCall(creds: Record<string, string>, op: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${i4uBase(creds)}/${op}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, token: creds.apiKey }),
  });
  const body = await readBody(res);
  const result = typeof body === "object" && body !== null ? (body as Record<string, unknown>)[`${op}Result`] : undefined;
  return { res, body, result };
}

const invoice4u = {
  async verify(creds: Record<string, string>): Promise<ProviderResult> {
    if (!creds.apiKey) return { ok: false, status: 400, error: "Clé API Invoice4U manquante" };
    const { res, body, result } = await i4uCall(creds, "IsAuthenticated");
    if (!res.ok) return fail(res.status, body);
    const err = i4uErrors(result);
    if (err || !result) return { ok: false, status: 401, error: err ?? "Clé API refusée (réponse vide)", raw: body };
    return { ok: true, status: res.status, raw: body };
  },
  async create(creds: Record<string, string>, invoice: InvoiceInput): Promise<ProviderResult> {
    if (!creds.apiKey) return { ok: false, status: 400, error: "Clé API Invoice4U manquante" };
    const type = i4uDocType(invoice.documentType);
    const { total } = totals(invoice);
    const today = new Date().toISOString().slice(0, 10);

    const doc: Record<string, unknown> = {
      DocumentType: type,
      Subject: invoice.items[0]?.description ?? "",
      GeneralCustomer: { Name: invoice.clientName ?? "" },
      Currency: currencyCode(invoice.currency),
      TaxIncluded: false,
      Language: 1, // 1 = hébreu, 2 = anglais
      ExternalComments: invoice.notes ?? "",
      ApiIdentifier: invoice.invoiceNumber ? `frenchy-${invoice.invoiceNumber}` : undefined,
      AutoFixPaymentsMismatchItems: true,
    };
    if (invoice.vatRate != null) doc.TaxPercentage = Number(invoice.vatRate);
    if (invoice.dueDate) doc.PaymentDueDate = `${invoice.dueDate}T00:00:00`;
    if (invoice.clientEmail) doc.AssociatedEmails = [{ Mail: invoice.clientEmail, IsUserMail: false }];
    // Un reçu (type 2) ne porte pas de lignes, uniquement des paiements
    if (type !== 2) {
      doc.Items = invoice.items.map((i) => ({
        Name: i.description,
        Quantity: Number(i.quantity || 0),
        Price: Number(i.unitPrice || 0),
      }));
    }
    // Reçu et Facture-reçu exigent des paiements ; le formulaire ne collecte pas encore
    // le mode de paiement -> virement (3) par défaut, du montant TTC calculé.
    if (type === 2 || type === 3) {
      doc.Payments = [{ PaymentType: 3, Amount: Number(total.toFixed(2)), Date: `${today}T00:00:00`, NumberOfPayments: 1 }];
    }

    const { res, body, result } = await i4uCall(creds, "CreateDocument", { doc });
    if (!res.ok) return fail(res.status, body);
    const err = i4uErrors(result);
    if (err || !result) return { ok: false, status: res.status, error: err ?? "Réponse vide d'Invoice4U", raw: body };
    const r = result as Record<string, unknown>;
    return {
      ok: true,
      status: res.status,
      externalId: r.ID != null ? String(r.ID) : undefined,
      externalNumber: r.DocumentNumber != null ? String(r.DocumentNumber) : undefined,
      pdfUrl: (r.PrintOriginalPDFLink as string) ?? (r.PrintCertifiedCopyPDFLink as string) ?? undefined,
      raw: body,
    };
  },
};

/* ------------------------------------------------------------------ */
/* iCount — token API (Bearer), API v3                                  */
/* Source : connecteur open-source n8n-nodes-icount (npm, 330 tests) et */
/* plugin WooCommerce officiel iCount — "You must use an API Token,     */
/* not cid/user/pass". Token créé dans iCount : הגדרות → API.            */
/* - POST https://api.icount.co.il/api/v3.php/doc/create (JSON)         */
/* - vérification : GET /api/v3.php/app/info                            */
/* - réponse : { status, doc_number, pdf_link, doc_id } (parfois .data) */
/* ------------------------------------------------------------------ */

const ICOUNT_BASE = "https://api.icount.co.il/api/v3.php";

// Nos codes internes -> doctypes iCount (invoice, invrec, receipt, refund, order, offer, delivery, deal)
function icountDocType(documentType?: string): string {
  const map: Record<string, string> = { "320": "invrec", "305": "invoice", "400": "receipt", "330": "refund", "10": "offer", "100": "order" };
  return map[documentType ?? "320"] ?? "invrec";
}

async function icountCall(creds: Record<string, string>, path: string, method: "GET" | "POST", payload?: Record<string, unknown>) {
  const res = await fetch(`${ICOUNT_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${creds.apiKey}`, "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  return { res, body: await readBody(res) };
}

function icountError(body: unknown): string {
  const b = body as Record<string, unknown>;
  return (b?.message as string) ?? (b?.error_description as string) ?? (b?.error as string) ?? JSON.stringify(body).slice(0, 500);
}

const icount = {
  async verify(creds: Record<string, string>): Promise<ProviderResult> {
    if (!creds.apiKey) return { ok: false, status: 400, error: "Token API iCount manquant" };
    const { res, body } = await icountCall(creds, "/app/info", "GET");
    const b = body as Record<string, unknown>;
    if (!res.ok || b?.status === false) return { ok: false, status: res.ok ? 401 : res.status, error: icountError(body), raw: body };
    return { ok: true, status: res.status, raw: body };
  },
  async create(creds: Record<string, string>, invoice: InvoiceInput): Promise<ProviderResult> {
    if (!creds.apiKey) return { ok: false, status: 400, error: "Token API iCount manquant" };
    const type = icountDocType(invoice.documentType);
    const { total } = totals(invoice);
    const today = new Date().toISOString().slice(0, 10);

    const payload: Record<string, unknown> = {
      doctype: type,
      lang: "he",
      currency_code: currencyCode(invoice.currency),
      client_name: invoice.clientName ?? "",
      items: invoice.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity || 0),
        unitprice: Number(i.unitPrice || 0),
      })),
    };
    if (invoice.clientEmail) payload.email = invoice.clientEmail;
    if (invoice.clientAddress) payload.client_address = invoice.clientAddress;
    if (invoice.notes) payload.hwc = invoice.notes;
    if (invoice.date) payload.doc_date = invoice.date;
    if (invoice.dueDate) payload.duedate = invoice.dueDate;
    // Reçu et facture-reçu exigent un paiement ; le formulaire ne collecte pas encore
    // le mode de paiement -> virement bancaire par défaut, du montant TTC calculé.
    if (type === "invrec" || type === "receipt") {
      payload.banktransfer = { sum: total.toFixed(2), date: invoice.date || today };
    }

    const { res, body } = await icountCall(creds, "/doc/create", "POST", payload);
    const b = body as Record<string, unknown>;
    if (!res.ok || b?.status === false) return { ok: false, status: res.status, error: icountError(body), raw: body };
    const d = ((b?.data as Record<string, unknown>) ?? b) as Record<string, unknown>;
    return {
      ok: true,
      status: res.status,
      externalId: d?.doc_id != null ? String(d.doc_id) : undefined,
      externalNumber: d?.doc_number != null ? String(d.doc_number) : (d?.docnum != null ? String(d.docnum) : undefined),
      pdfUrl: (d?.pdf_link as string) ?? (d?.doc_url as string) ?? undefined,
      raw: body,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Invoice Maven — clé API Bearer                                       */
/* ------------------------------------------------------------------ */

// Endpoint officiel confirmé : https://www.invoice-maven.co.il/support/api/add-document/
// Tous les champs de la requête doivent être en lowercase (contrainte imposée par Invoice Maven).
const MAVEN_ADD_DOCUMENT_URL = "https://app.invoice-maven.co.il/api/documents/addDocument";
// Coordonnées du développeur de l'intégration, exigées par Invoice Maven en cas de souci technique
// (pas les coordonnées du client final) — à définir dans les secrets Supabase.
const MAVEN_CONTACT_EMAIL = Deno.env.get("INVOICEMAVEN_CONTACT_EMAIL") ?? "";
const MAVEN_CONTACT_PHONE = Deno.env.get("INVOICEMAVEN_CONTACT_PHONE") ?? "";

function mavenDocType(documentType?: string) {
  // Mappe nos codes internes (partagés avec Green Invoice/SmartBee) vers les codes Invoice Maven
  const map: Record<string, number> = { "320": 320, "305": 305, "400": 400, "330": 330, "10": 10, "100": 100 };
  return map[documentType ?? "320"] ?? 320;
}

async function mavenCall(creds: Record<string, string>, extra: Record<string, unknown>, forceTest = false) {
  const payload = {
    api_key: creds.apiKey,
    test: forceTest || creds.testMode === "true" ? 1 : 0,
    contact_email: MAVEN_CONTACT_EMAIL,
    contact_phone: MAVEN_CONTACT_PHONE,
    ...extra,
  };
  const res = await fetch(MAVEN_ADD_DOCUMENT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(payload),
  });
  return { res, body: await readBody(res) };
}

const invoicemaven = {
  async verify(creds: Record<string, string>): Promise<ProviderResult> {
    if (!creds.apiKey) return { ok: false, status: 400, error: "Clé API manquante" };
    // Invoice Maven n'a pas d'endpoint de vérification dédié : on tente une émission
    // en mode test (test=1, aucun document réel n'est créé ni envoyé au client).
    const { res, body } = await mavenCall(creds, {
      doc_type: 305, // facture simple : aucun paiement requis pour ce test
      customer: { name: "Test de connexion" },
      items: [{ description: "Vérification API", price: 1 }],
    }, true);
    const b = body as Record<string, unknown>;
    return res.ok && b?.status_code === 0
      ? { ok: true, status: res.status, raw: body }
      : fail(res.status, body);
  },
  async create(creds: Record<string, string>, invoice: InvoiceInput): Promise<ProviderResult> {
    const type = mavenDocType(invoice.documentType);
    const { total } = totals(invoice);
    const toMavenDate = (iso?: string) => {
      const d = iso ? new Date(iso) : new Date();
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}/${d.getFullYear()}`; // format dd/MM/yyyy exigé par Invoice Maven
    };
    const extra: Record<string, unknown> = {
      doc_type: type,
      remarks: invoice.notes ?? "",
      english_document: 0, // document en hébreu
      customer: {
        name: invoice.clientName ?? "",
        email: invoice.clientEmail ?? "",
        address: invoice.clientAddress ?? "",
      },
    };
    if (invoice.dueDate) extra.due_date = toMavenDate(invoice.dueDate);
    // Un reçu (400) ne doit pas porter de lignes (doc officielle)
    if (type !== 400) {
      extra.items = invoice.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity || 1),
        price: Number(i.unitPrice || 0),
      }));
    }
    // Reçu (400) et facture-reçu (320) exigent des paiements ; le formulaire ne collecte
    // pas encore le mode de paiement -> virement bancaire (payment_type 1), montant TTC.
    if (type === 320 || type === 400) {
      extra.payments = [{ payment_date: toMavenDate(invoice.date), payment_type: 1, amount: Number(total.toFixed(2)) }];
    }
    const { res, body } = await mavenCall(creds, extra);
    const b = body as Record<string, unknown>;
    if (!res.ok || b?.status_code !== 0) return fail(res.status, body);
    return {
      ok: true,
      status: res.status,
      externalNumber: String(b?.doc_no ?? ""),
      pdfUrl: (b?.pdf_original as string) ?? undefined,
      raw: body,
    };
  },
};

export const PROVIDERS: Record<
  ProviderId,
  {
    label: string;
    verify: (creds: Record<string, string>, ) => Promise<ProviderResult>;
    create: (creds: Record<string, string>, invoice: InvoiceInput) => Promise<ProviderResult>;
  }
> = {
  smartbee: { label: "SmartBee", ...smartbee },
  greeninvoice: { label: "Green Invoice (Morning)", ...greeninvoice },
  invoice4u: { label: "Invoice4U", ...invoice4u },
  icount: { label: "iCount", ...icount },
  invoicemaven: { label: "Invoice Maven", ...invoicemaven },
};

export function isProvider(v: unknown): v is ProviderId {
  return typeof v === "string" && v in PROVIDERS;
}
