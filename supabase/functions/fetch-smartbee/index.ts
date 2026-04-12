import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GREENINVOICE_BASE = "https://api.greeninvoice.co.il/api/v1";

// Récupère la clé API depuis le profil utilisateur
async function getApiKey(authHeader: string): Promise<string> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Non authentifié");

  const { data } = await supabase
    .from("profiles")
    .select("smartbee_api_key")
    .eq("id", user.id)
    .single();

  if (!data?.smartbee_api_key) {
    throw new Error("Compte SmartBee non connecté");
  }
  return data.smartbee_api_key;
}

// Appel générique à l'API Green Invoice avec la clé API directement
async function giFetch(path: string, apiKey: string, body?: unknown) {
  const res = await fetch(`${GREENINVOICE_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GI ${path} [${res.status}]: ${text}`);
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

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") ?? "clients";

    const apiKey = await getApiKey(authHeader);

    let data;

    if (resource === "account") {
      data = await giFetch("/account", apiKey);
    } else if (resource === "clients") {
      data = await giFetch("/clients/search", apiKey, { page: 1, pageSize: 100 });
    } else if (resource === "items") {
      data = await giFetch("/items/search", apiKey, { page: 1, pageSize: 100 });
    } else {
      throw new Error(`Ressource inconnue : ${resource}`);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("fetch-smartbee error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
