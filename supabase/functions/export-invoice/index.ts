import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "@supabase/supabase-js/cors";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface ExportRequest {
  provider: "greeninvoice" | "invoice4u" | "icount" | "invoicemaven";
  invoice: {
    invoiceNumber: string;
    date: string;
    dueDate: string;
    senderName: string;
    senderAddress: string;
    senderPhone: string;
    senderEmail: string;
    senderSiret: string;
    clientName: string;
    clientAddress: string;
    clientEmail: string;
    items: InvoiceItem[];
    vatRate: number;
    currency: string;
    notes: string;
  };
}

// ─── Green Invoice (Morning / SmartBee) ───
async function exportToGreenInvoice(invoice: ExportRequest["invoice"]) {
  const apiKey = Deno.env.get("SMARTBEE_API_KEY");
  if (!apiKey) throw new Error("SMARTBEE_API_KEY is not configured");

  // Step 1: Get JWT token
  const tokenRes = await fetch("https://api.greeninvoice.co.il/api/v1/account/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: apiKey, secret: Deno.env.get("SMARTBEE_SECRET") || "" }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Green Invoice auth failed [${tokenRes.status}]: ${err}`);
  }

  const { token } = await tokenRes.json();

  // Step 2: Create document (type 320 = Tax Invoice-Receipt)
  const docRes = await fetch("https://api.greeninvoice.co.il/api/v1/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 320,
      client: { name: invoice.clientName, address: invoice.clientAddress, emails: [invoice.clientEmail] },
      income: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        vatType: 0,
      })),
      remarks: invoice.notes,
      date: invoice.date,
      dueDate: invoice.dueDate,
      lang: "he",
      currency: invoice.currency === "₪" ? "ILS" : invoice.currency === "€" ? "EUR" : "USD",
    }),
  });

  if (!docRes.ok) {
    const err = await docRes.text();
    throw new Error(`Green Invoice create failed [${docRes.status}]: ${err}`);
  }

  return await docRes.json();
}

// ─── Invoice4U ───
async function exportToInvoice4U(invoice: ExportRequest["invoice"]) {
  const apiKey = Deno.env.get("INVOICE4U_API_KEY");
  if (!apiKey) throw new Error("INVOICE4U_API_KEY is not configured");

  const res = await fetch("https://api.invoice4u.co.il/Services/ApiService.svc/CreateDocument", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      type: 1, // חשבונית מס
      clientName: invoice.clientName,
      clientAddress: invoice.clientAddress,
      clientEmail: invoice.clientEmail,
      items: invoice.items.map((item) => ({
        Description: item.description,
        Quantity: item.quantity,
        UnitPrice: item.unitPrice,
        VatRate: invoice.vatRate,
      })),
      remarks: invoice.notes,
      date: invoice.date,
      dueDate: invoice.dueDate,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Invoice4U create failed [${res.status}]: ${err}`);
  }

  return await res.json();
}

// ─── iCount ───
async function exportToICount(invoice: ExportRequest["invoice"]) {
  const cid = Deno.env.get("ICOUNT_COMPANY_ID");
  const user = Deno.env.get("ICOUNT_USER");
  const pass = Deno.env.get("ICOUNT_PASS");
  if (!cid || !user || !pass) throw new Error("iCount credentials (ICOUNT_COMPANY_ID, ICOUNT_USER, ICOUNT_PASS) are not configured");

  const res = await fetch("https://api.icount.co.il/api/v3.php/doc/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cid,
      user,
      pass,
      doctype: "invrec", // חשבונית מס קבלה
      client_name: invoice.clientName,
      client_address: invoice.clientAddress,
      client_email: invoice.clientEmail,
      items: invoice.items.map((item) => ({
        description: item.description,
        unitprice: item.unitPrice,
        quantity: item.quantity,
      })),
      remarks: invoice.notes,
      doc_date: invoice.date,
      due_date: invoice.dueDate,
      currency_code: invoice.currency === "₪" ? "ILS" : invoice.currency === "€" ? "EUR" : "USD",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`iCount create failed [${res.status}]: ${err}`);
  }

  return await res.json();
}

// ─── Invoice Maven ───
async function exportToInvoiceMaven(invoice: ExportRequest["invoice"]) {
  const apiKey = Deno.env.get("INVOICEMAVEN_API_KEY");
  if (!apiKey) throw new Error("INVOICEMAVEN_API_KEY is not configured");

  const res = await fetch("https://app.invoice-maven.co.il/api/documents/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      test: 0,
      type: 305, // חשבונית מס
      client_name: invoice.clientName,
      client_address: invoice.clientAddress,
      client_email: invoice.clientEmail,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
      remarks: invoice.notes,
      date: invoice.date,
      due_date: invoice.dueDate,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Invoice Maven create failed [${res.status}]: ${err}`);
  }

  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: ExportRequest = await req.json();
    const { provider, invoice } = body;

    if (!provider || !invoice) {
      return new Response(JSON.stringify({ error: "Missing provider or invoice data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;
    switch (provider) {
      case "greeninvoice":
        result = await exportToGreenInvoice(invoice);
        break;
      case "invoice4u":
        result = await exportToInvoice4U(invoice);
        break;
      case "icount":
        result = await exportToICount(invoice);
        break;
      case "invoicemaven":
        result = await exportToInvoiceMaven(invoice);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
