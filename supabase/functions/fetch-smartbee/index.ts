import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMARTBEE_BASE = "https://test.smartbee.co.il/api/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader!);

    const { data: profile } = await supabase
      .from("profiles")
      .select("smartbee_api_key")
      .eq("id", user?.id)
      .single();

    const apiKey = profile?.smartbee_api_key?.trim();
    if (!apiKey) throw new Error("Clé manquante");

    // ÉTAPE 1 : Authentification (Mandatory selon ton Swagger)
    // On envoie la clé pour récupérer un jeton de session
    const authRes = await fetch(`${SMARTBEE_BASE}/Login/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey })
    });

    const authData = await authRes.json();

    if (!authRes.ok || !authData.token) {
      throw new Error("Échec de l'authentification initiale chez Smartbee");
    }

    // ÉTAPE 2 : Test de la session
    // Maintenant on utilise le jeton reçu (Bearer) pour appeler User/Me
    const testRes = await fetch(`${SMARTBEE_BASE}/User/Me`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authData.token}` 
      },
      body: JSON.stringify({}) // Plus besoin d'apiKey ici, le token suffit
    });

    if (!testRes.ok) throw new Error("Jeton obtenu mais refusé par le serveur");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
