import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Note : L'URL peut varier. Si ça échoue, essaye sans le "/api/v1" ou avec "https://api.smartbee.co.il"
const SMARTBEE_BASE = "https://server.smartbee.co.il/api/v1";

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

    const apiKey = profile?.smartbee_api_key;
    if (!apiKey) throw new Error("Clé introuvable");

    // Tentative de vérification sur l'un des rares endpoints GET de Smartbee
    // Si l'API est capricieuse, on tente un POST vide sur une route de test
    const res = await fetch(`${SMARTBEE_BASE}/user/me`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey })
    });

    // On accepte la réussite si Smartbee répond positivement
    if (!res.ok) {
      const errorDetail = await res.text();
      console.error("Smartbee rejection:", errorDetail);
      throw new Error("Clé rejetée par Smartbee");
    }

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
