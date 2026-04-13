import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URL extraite de ton Swagger
const SMARTBEE_BASE = "https://test.smartbee.co.il:443/api/v1";

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

    // On utilise l'endpoint User/Me avec la casse correcte
    const res = await fetch(`${SMARTBEE_BASE}/User/Me`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ apiKey })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Smartbee Error Details:", errorText);
      throw new Error(`Erreur Smartbee: ${res.status}`);
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
