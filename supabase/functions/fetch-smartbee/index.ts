import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMARTBEE_BASE = "https://server.smartbee.co.il/api/v1";

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
    throw new Error("Clé API Smartbee manquante");
  }
  return data.smartbee_api_key;
}

async function smartbeeFetch(path: string, apiKey: string, body: any = {}) {
  const payload = { apiKey, ...body };
  const res = await fetch(`${SMARTBEE_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erreur Smartbee [${res.status}]: ${text}`);
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Header manquant");

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") || "check_auth";
    const apiKey = await getApiKey(authHeader);

    let result;
    if (resource === "check_auth") {
      // On tente de récupérer les infos de l'utilisateur pour valider la clé
      result = await smartbeeFetch("/user/me", apiKey);
    } else if (resource === "clients") {
      result = await smartbeeFetch("/get-clients", apiKey);
    } else {
      throw new Error(`Ressource non supportée : ${resource}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
