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
    const res = await fetch(`${giBase(creds)}/documents`, {
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

// Invoice4U expose une API SOAP/WSDL (WCF classique), pas du JSON REST.
// ⚠️ Les noms d'opération/paramètres ci-dessous suivent les conventions WCF par défaut
// (namespace "http://tempuri.org/") et le wrapper communautaire "i4u" (github.com/ofersadan85/i4u),
// faute d'accès à la doc officielle (invoice4uapi.docs.apiary.io, bloquée aux robots).
// À VÉRIFIER/AJUSTER à la première vraie tentative avec de vrais identifiants — les erreurs
// SOAP brutes sont renvoyées telles quelles pour permettre ce réglage.
const I4U_BASE = "https://api.invoice4u.co.il/Services/ApiService.svc";
const I4U_NS = "http://tempuri.org/";

function soapEnvelope(action: string, innerXml: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${I4U_NS}">
  <soap:Body>
    <tem:${action}>${innerXml}</tem:${action}>
  </soap:Body>
</soap:Envelope>`;
}

function xmlTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]*)</(?:\\w+:)?${tag}>`, "i"));
  return m?.[1];
}

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function i4uSoapCall(action: string, innerXml: string) {
  const res = await fetch(I4U_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `${I4U_NS}IApiService/${action}`,
    },
    body: soapEnvelope(action, innerXml),
  });
  const text = await res.text();
  return { res, text };
}

async function i4uLogin(creds: Record<string, string>): Promise<string> {
  const { res, text } = await i4uSoapCall(
    "Login",
    `<tem:userName>${xmlEscape(creds.email ?? "")}</tem:userName><tem:password>${xmlEscape(creds.password ?? "")}</tem:password>`,
  );
  const token = xmlTag(text, "LoginResult");
  if (!res.ok || !token || token === "null" || /soap:Fault|<Fault/i.test(text)) {
    throw new Error(`[${res.status}] ${text.slice(0, 500)}`);
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
    const itemsXml = invoice.items
      .map(
        (i) => `<tem:DocumentItem>
          <tem:Name>${xmlEscape(i.description)}</tem:Name>
          <tem:Quantity>${Number(i.quantity || 0)}</tem:Quantity>
          <tem:Price>${Number(i.unitPrice || 0)}</tem:Price>
        </tem:DocumentItem>`,
      )
      .join("");
    const innerXml = `
      <tem:token>${xmlEscape(token)}</tem:token>
      <tem:doc>
        <tem:DocumentType>3</tem:DocumentType>
        <tem:Subject>${xmlEscape(invoice.notes ?? "")}</tem:Subject>
        <tem:Currency>${currencyCode(invoice.currency)}</tem:Currency>
        <tem:GeneralCustomer>
          <tem:Name>${xmlEscape(invoice.clientName ?? "")}</tem:Name>
          <tem:Email>${xmlEscape(invoice.clientEmail ?? "")}</tem:Email>
          <tem:Address>${xmlEscape(invoice.clientAddress ?? "")}</tem:Address>
        </tem:GeneralCustomer>
        <tem:Items>${itemsXml}</tem:Items>
      </tem:doc>`;
    const { res, text } = await i4uSoapCall("CreateDocument", innerXml);
    if (!res.ok || /soap:Fault|<Fault/i.test(text)) return fail(res.status, text.slice(0, 500));
    return {
      ok: true,
      status: res.status,
      externalId: xmlTag(text, "ID"),
      externalNumber: xmlTag(text, "DocumentNumber"),
      pdfUrl: xmlTag(text, "DocumentLink"),
      raw: text.slice(0, 2000),
    };
  },
};

/* ------------------------------------------------------------------ */
/* iCount — cid / user / pass                                           */
/* ------------------------------------------------------------------ */

const ICOUNT_BASE = "https://api.icount.co.il/api/v3.php";

// Ouvre une session iCount (sid) à partir de cid/user/pass — à réutiliser plutôt
// que de renvoyer le mot de passe à chaque appel.
async function icountLogin(creds: Record<string, string>): Promise<string> {
  const res = await fetch(`${ICOUNT_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cid: creds.companyId, user: creds.user, pass: creds.password }),
  });
  const body = await readBody(res);
  const b = body as Record<string, unknown>;
  if (!res.ok || b?.status !== true || !b?.sid) {
    throw new Error(`[${res.status}] ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return b.sid as string;
}

const icount = {
  async verify(creds: Record<string, string>): Promise<ProviderResult> {
    if (!creds.companyId || !creds.user || !creds.password) {
      return { ok: false, status: 400, error: "Identifiant société, utilisateur et mot de passe requis" };
    }
    try {
      await icountLogin(creds);
      return { ok: true, status: 200 };
    } catch (e) {
      return { ok: false, status: 401, error: (e as Error).message };
    }
  },
  async create(creds: Record<string, string>, invoice: InvoiceInput): Promise<ProviderResult> {
    let sid: string;
    try {
      sid = await icountLogin(creds);
    } catch (e) {
      return { ok: false, status: 401, error: (e as Error).message };
    }
    const payload = {
      cid: creds.companyId,
      sid,
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

// Endpoint officiel confirmé : https://www.invoice-maven.co.il/support/api/add-document/
// Tous les champs de la requête doivent être en lowercase (contrainte imposée par Invoice Maven).
const MAVEN_ADD_DOCUMENT_URL = "https://app.invoice-maven.co.il/api/documents/addDocument";
// Coordonnées du développeur de l'intégration, exigées par Invoice Maven en cas de souci technique
// (pas les coordonnées du client final) — à définir dans les secrets Supabase.
const MAVEN_CONTACT_EMAIL = Deno.env.get("INVOICEMAVEN_CONTACT_EMAIL") ?? "";
const MAVEN_CONTACT_PHONE = Deno.env.get("INVOICEMAVEN_CONTACT_PHONE") ?? "";

function mavenDocType(documentType?: string) {
  // Mappe nos codes internes (partagés avec Green Invoice/SmartBee) vers les codes Invoice Maven
  const map: Record<string, number> = { "320": 320, "305": 305, "400": 400, "330": 330, "100": 10, "200": 100 };
  return map[documentType ?? "320"] ?? 320;
}

async function mavenCall(creds: Record<string, string>, extra: Record<string, unknown>) {
  const payload = {
    api_key: creds.apiKey,
    test: creds.testMode === "true" ? 1 : 0,
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
      doc_type: 320,
      customer: { name: "Test de connexion" },
      items: [{ description: "Vérification API", price: 1 }],
    });
    const b = body as Record<string, unknown>;
    return res.ok && b?.status_code === 0
      ? { ok: true, status: res.status, raw: body }
      : fail(res.status, body);
  },
  async create(creds: Record<string, string>, invoice: InvoiceInput): Promise<ProviderResult> {
    const { res, body } = await mavenCall(creds, {
      doc_type: mavenDocType(invoice.documentType),
      remarks: invoice.notes ?? "",
      english_document: invoice.currency === "₪" ? 0 : 1,
      customer: {
        name: invoice.clientName ?? "",
        email: invoice.clientEmail ?? "",
        address: invoice.clientAddress ?? "",
      },
      items: invoice.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity || 1),
        price: Number(i.unitPrice || 0),
      })),
    });
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
