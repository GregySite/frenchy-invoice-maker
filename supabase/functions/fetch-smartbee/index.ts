import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GREENINVOICE_BASE = "https://api.greeninvoice.co.il/api/v1";

// Récupère ID + Secret depuis Supabase
async function getCredentials(authHeader: string) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Non authentifié");

  const { data } = await supabase
    .from("profiles")
    .select("smartbee_api_key, smartbee_api_secret")
    .eq("id", user.id)
    .single();

  if (!data?.smartbee_api_key || !data?.smartbee_api_secret) {
    throw new Error("Compte SmartBee non connecté");
  }
  return { id: data.smartbee_api_key, secret: data.smartbee_api_secret };
}

// Obtient un JWT frais
async function getJwt(id: string, secret: string): Promise<string> {
  const res = await fetch(`${GREENINVOICE_BASE}/account/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, secret }),
  });
  if (!res.ok) throw new Error(`Auth SmartBee échouée [${res.status}]`);
  const data = await res.json();
  if (!data.token) throw new Error("Token introuvable");
  return data.token;
}

// Appel générique à l'API Green Invoice
async function giFetch(path: string, jwt: string) {
  const res = await fetch(`${GREENINVOICE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error(`GI ${path} [${res.status}]`);
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non authentifié");

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") ?? "clients";

    const { id, secret } = await getCredentials(authHeader);
    const jwt = await getJwt(id, secret);

    let data;

    if (resource === "account") {
      // Infos du compte (nom, adresse, email, téléphone, n° entreprise)
      data = await giFetch("/account", jwt);

    } else if (resource === "clients") {
      // Liste des clients (jusqu'à 100)
      data = await giFetch("/clients?page=1&per_page=100", jwt);

    } else if (resource === "items") {
      // Articles / services enregistrés
      data = await giFetch("/items?page=1&per_page=100", jwt);

    } else {
      throw new Error(`Ressource inconnue : ${resource}`);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
