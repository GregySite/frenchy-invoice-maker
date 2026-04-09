import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GREENINVOICE_BASE = "https://api.greeninvoice.co.il/api/v1";

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

// Récupère l'ID et le Secret depuis Supabase
async function getSmartBeeCredentials(authHeader: string): Promise<{ id: string; secret: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Non authentifié");

  const { data, error } = await supabase
    .from("profiles")
    .select("smartbee_api_key, smartbee_api_secret")
    .eq("id", user.id)
    .single();

  if (error || !data?.smartbee_api_key || !data?.smartbee_api_secret) {
    throw new Error("Compte SmartBee non connecté. Cliquez sur l'icône ⚙️ pour configurer.");
  }

  return { id: data.smartbee_api_key, secret: data.smartbee_api_secret };
}

// Échange ID + Secret contre un JWT Bearer token
async function getJwtToken(id: string, secret: string): Promise<string> {
  const res = await fetch(`${GREENINVOICE_BASE}/account/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, secret }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Authentification SmartBee échouée [${res.status}]: ${err}`);
  }

  const data = await res.json();
  if (!data.token) throw new Error("Token SmartBee introuvable dans la réponse");

  return data.token;
}

// Crée le document dans Green Invoice
async function exportToSmartBee(
  invoice: ExportRequest["invoice"],
  jwtToken: string
) {
  const currencyMap: Record<string, string> = {
    "₪": "ILS",
    "€": "EUR",
    "$": "USD",
  };

  const res = await fetch(`${GREENINVOICE_BASE}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
    body: JSON.stringify({
      type: 320, // חשבונית קבלה — Facture + Reçu (le plus courant pour עוסק פטור/מורשה)
      client: {
        name: invoice.clientName,
        address: invoice.clientAddress,
        emails: invoice.clientEmail ? [invoice.clientEmail] : [],
      },
      income: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        vatType: 0, // TVA gérée automatiquement par Green Invoice selon le type de compte
      })),
      remarks: invoice.notes || undefined,
      date: invoice.date,
      dueDate: invoice.dueDate || undefined,
      lang: "he",
      currency: currencyMap[invoice.currency] ?? "ILS",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Création du document échouée [${res.status}]: ${err}`);
  }

  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ExportRequest = await req.json();
    if (!body.invoice) {
      return new Response(JSON.stringify({ error: "Données de facture manquantes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Récupérer les credentials depuis Supabase
    const { id, secret } = await getSmartBeeCredentials(authHeader);

    // 2. Obtenir un JWT frais auprès de Green Invoice
    const jwtToken = await getJwtToken(id, secret);

    // 3. Créer le document
    const result = await exportToSmartBee(body.invoice, jwtToken);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Export error:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
