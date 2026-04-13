import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URL de l'API Smartbee (Vérifie dans ta console Smartbee si une V2 est disponible)
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
    throw new Error("Clé API Smartbee manquante dans votre profil");
  }
  return data.smartbee_api_key;
}

/**
 * Fonction d'appel à Smartbee
 * Note : Smartbee demande souvent l'API Key dans le corps (JSON) 
 * ou via un header spécifique. Ici on l'ajoute en Header par défaut.
 */
async function smartbeeFetch(path: string, apiKey: string, body: any = {}) {
  // On injecte souvent l'apiKey directement dans le JSON pour Smartbee
  const payload = {
    apiKey: apiKey,
    ...body
  };

  const res = await fetch(`${SMARTBEE_BASE}${path}`, {
    method: "POST", // La majorité des endpoints Smartbee sont en POST
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Smartbee Error [${res.status}]: ${text}`);
  }
  return await res.json();
}

serve(async (req) => {
  // Gestion du CORS pour le navigateur
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Header d'autorisation manquant");

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") || "clients";

    const apiKey = await getApiKey(authHeader);

    let result;

    // Adaptation des routes selon les besoins de ton interface
    switch (resource) {
      case "check_auth":
        // Endpoint typique pour vérifier si la clé est valide
        result = await smartbeeFetch("/test-auth", apiKey);
        break;
      
      case "clients":
        // Route Smartbee pour récupérer les clients
        result = await smartbeeFetch("/get-clients", apiKey, { count: 100 });
        break;

      case "items":
        // Route Smartbee pour récupérer les articles/services
        result = await smartbeeFetch("/get-items", apiKey);
        break;

      default:
        throw new Error(`Ressource non supportée : ${resource}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Erreur Edge Function:", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
