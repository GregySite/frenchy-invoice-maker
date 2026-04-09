import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface ExportRequest {
  provider: "greeninvoice";
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

async function exportToSmartBee(invoice: ExportRequest["invoice"]) {
  const apiKey = Deno.env.get("SMARTBEE_API_KEY");
  if (!apiKey) throw new Error("SMARTBEE_API_KEY is not configured");

  // SmartBee / Green Invoice uses the API key directly as bearer token
  const docRes = await fetch("https://api.greeninvoice.co.il/api/v1/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      type: 320,
      client: {
        name: invoice.clientName,
        address: invoice.clientAddress,
        emails: [invoice.clientEmail],
      },
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
    throw new Error(`SmartBee create failed [${docRes.status}]: ${err}`);
  }

  return await docRes.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: ExportRequest = await req.json();
    const { invoice } = body;

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Missing invoice data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await exportToSmartBee(invoice);

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
