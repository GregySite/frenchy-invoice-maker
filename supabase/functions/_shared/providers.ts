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
  documentType?: string; // code Green Invoice/SmartBee (320, 305, 400...)
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
        JSON.stringify(body).slice(0, 500);
  return { ok: false, status, error, raw: body };
}

/* ------------------------------------------------------------------ */
/* SmartBee (smartbee.co.il) — clé API unique envoyée dans le body      */
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

const GI_BASE = "https://api.greeninvoice.co.il/api/v1";

async function giToken(creds: Record<string, string>) {
  const res = await fetch(`${GI_BASE}/account/token`, {
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
    const payload = {
      type: Number(invoice.documentType ?? 320),
      lang: "he",
      currency: currencyCode(invoice.currency),
      vatType: 0,
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
    };
    const res = await fetch(`${GI_BASE}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const body = await readBody(res);
    if (!res.ok) return fail(res.status, body);
    const b = body as Record<string, string>;
    return { ok: true, status: res.status, externalId: b?.id, externalNumber: String(b?.number ?? ""), pdfUrl: b?.url, raw: body };
  },
};

/* ------------------------------------------------------------------ */
/* Invoice4U — login email/mot de passe -> token                        */
/* ------------------------------------------------------------------ */

const I4U_BASE = "https://api.invoice4u.co.il/Services/ApiService.svc";

async function i4uLogin(creds: Record<string, string>) {
  const res = await fetch(`${I4U_BASE}/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  const body = await readBody(res);
  const token = typeof body === "string" ? body.replace(/"/g, "") : (body as Record<string, string>)?.d;
  if (!res.ok || !token || token === "null") {
    throw new Error(`[${res.status}] ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return token;
}

const invoice4u = {
  async verify(creds: Record<string, string>): Promise<ProviderResult> {
    if (!creds.email || !creds.password) return { ok: false, status: 400, error: "Email et mot de passe requis" };
    try {
      await i4uLogin(creds);
      return { ok: true, status: 200 };
    } catch (e) {
      return { ok: false, status: 401, error: (e as Error).message };
    }
  },
  async create(creds: Record<string, string>, invoice: InvoiceInput): Promise<ProviderResult> {
    let token: string;
    try {
      token = await i4uLogin(creds);
    } catch (e) {
      return { ok: false, status: 401, error: (e as Error).message };
    }
    const { total } = totals(invoice);
    const payload = {
      token,
      doc: {
        DocumentType: 3, // חשבונית מס קבלה
        Subject: invoice.notes ?? "",
        Currency: currencyCode(invoice.currency),
        GeneralCustomer: {
          Name: invoice.clientName ?? "",
          Email: invoice.clientEmail ?? "",
          Address: invoice.clientAddress ?? "",
        },
        Items: invoice.items.map((i) => ({
          Name: i.description,
          Quantity: Number(i.quantity || 0),
          Price: Number(i.unitPrice || 0),
        })),
        Total: total,
      },
    };
    const res = await fetch(`${I4U_BASE}/CreateDocument`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await readBody(res);
    if (!res.ok) return fail(res.status, body);
    const d = (body as Record<string, Record<string, string>>)?.d ?? (body as Record<string, string>);
    return {
      ok: true,
      status: res.status,
      externalId: String((d as Record<string, string>)?.ID ?? ""),
      externalNumber: String((d as Record<string, string>)?.DocumentNumber ?? ""),
      pdfUrl: (d as Record<string, string>)?.DocumentLink,
      raw: body,
    };
  },
};

/* ------------------------------------------------------------------ */
/* iCount — cid / user / pass                                           */
/* ------------------------------------------------------------------ */

const ICOUNT_BASE = "https://api.icount.co.il/api/v3.php";

const icount = {
  async verify(creds: Record<string, string>): Promise<ProviderResult> {
    if (!creds.companyId || !creds.user || !creds.password) {
      return { ok: false, status: 400, error: "Identifiant société, utilisateur et mot de passe requis" };
    }
    const res = await fetch(`${ICOUNT_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid: creds.companyId, user: creds.user, pass: creds.password }),
    });
    const body = await readBody(res);
    const okFlag = (body as Record<string, unknown>)?.status === true;
    return res.ok && okFlag ? { ok: true, status: res.status, raw: body } : fail(res.status, body);
  },
  async create(creds: Record<string, string>, invoice: InvoiceInput): Promise<ProviderResult> {
    const payload = {
      cid: creds.companyId,
      user: creds.user,
      pass: creds.password,
      doctype: "invrec",
      client_name: invoice.clientName ?? "",
      email: invoice.clientEmail ?? "",
      client_address: invoice.clientAddress ?? "",
      currency_code: currencyCode(invoice.currency),
      lang: "he",
      hwc: invoice.notes ?? "",
      items: invoice.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity || 0),
        unitprice: Number(i.unitPrice || 0),
      })),
    };
    const res = await fetch(`${ICOUNT_BASE}/doc/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await readBody(res);
    const b = body as Record<string, unknown>;
    if (!res.ok || b?.status !== true) return fail(res.status, body);
    return {
      ok: true,
      status: res.status,
      externalId: String(b?.docnum ?? ""),
      externalNumber: String(b?.docnum ?? ""),
      pdfUrl: (b?.doc_url as string) ?? undefined,
      raw: body,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Invoice Maven — clé API Bearer                                       */
/* ------------------------------------------------------------------ */

const MAVEN_BASE = Deno.env.get("INVOICEMAVEN_BASE_URL") ?? "https://api.invoicemaven.co.il/api/v1";

const invoicemaven = {
  async verify(creds: Record<string, string>): Promise<ProviderResult> {
    if (!creds.apiKey) return { ok: false, status: 400, error: "Clé API manquante" };
    const res = await fetch(`${MAVEN_BASE}/account`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    const body = await readBody(res);
    return res.ok ? { ok: true, status: res.status, raw: body } : fail(res.status, body);
  },
  async create(creds: Record<string, string>, invoice: InvoiceInput): Promise<ProviderResult> {
    const payload = {
      type: "invoice_receipt",
      currency: currencyCode(invoice.currency),
      customer: {
        name: invoice.clientName ?? "",
        email: invoice.clientEmail ?? "",
        address: invoice.clientAddress ?? "",
      },
      remarks: invoice.notes ?? "",
      items: invoice.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity || 0),
        price: Number(i.unitPrice || 0),
        vat_rate: Number(invoice.vatRate ?? 0),
      })),
    };
    const res = await fetch(`${MAVEN_BASE}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.apiKey}` },
      body: JSON.stringify(payload),
    });
    const body = await readBody(res);
    if (!res.ok) return fail(res.status, body);
    const b = body as Record<string, string>;
    return { ok: true, status: res.status, externalId: b?.id, externalNumber: String(b?.number ?? ""), pdfUrl: b?.pdf_url, raw: body };
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
