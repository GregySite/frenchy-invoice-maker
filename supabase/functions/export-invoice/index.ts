import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URL de l'API Smartbee
const SMARTBEE_BASE = "https://server.smartbee.co.il/api/v1";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface ExportRequest {
  invoice: {
    invoiceNumber: string;
    date: string;
    dueDate: string;
    documentType: string;
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

async function getSmartBeeApiKey(authHeader: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Non authentifié");

  const { data, error } = await supabase
    .from("profiles")
    .select("smartbee_api_key")
    .eq("id", user.id)
    .single();

  if (error || !data?.smartbee_api_key) {
    throw new Error("Compte SmartBee non connecté. Vérifiez vos paramètres.");
  }

  return data.smartbee_api_key;
}

async function exportToSmartBee(
  invoice: ExportRequest["invoice"],
  apiKey: string
) {
  // Mapping des devises pour Smartbee
  const currencyMap: Record<string, number> = {
    "₪": 1,
    "$": 2,
    "€": 3,
  };

  // Préparation du payload spécifique à Smartbee
  const payload = {
    apiKey: apiKey,
    document_type: Number(invoice.documentType) || 320, // 320 = Heshbonit Mas/Kabala
    customer_name: invoice.clientName,
    customer_email: invoice.clientEmail,
    customer_address: invoice.clientAddress,
    date: invoice.date,
    currency_id: currencyMap[invoice.currency] || 1,
    comments: invoice.notes || "",
    is_tax_inclusive: true, // On considère que tes prix unitaires incluent la TVA
    items: invoice.items.map((item) => ({
      description: item.description, // Ton texte en français
      quantity: item.quantity,
      unit_price: item.unitPrice,
      tax_rate: invoice.vatRate || 17
    }))
  };

  const res = await fetch(`${SMARTBEE_BASE}/documents/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur Smartbee [${res.status}]: ${err}`);
  }

  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non authentifié");

    const body: ExportRequest = await req.json();
    if (!body.invoice) throw new Error("Données de facture manquantes");

    const apiKey = await getSmartBeeApiKey(authHeader);
    const result = await exportToSmartBee(body.invoice, apiKey);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Export error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
