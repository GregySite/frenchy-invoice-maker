import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PROVIDERS, isProvider } from "../_shared/providers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ success: false, error: "Non authentifié" }, 401);

    const body = await req.json().catch(() => ({}));
    const provider = body?.provider;
    if (!isProvider(provider)) return json({ success: false, error: "Plateforme inconnue" }, 400);

    const { data: row } = await supabase
      .from("provider_credentials")
      .select("credentials")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .maybeSingle();

    const creds = (body?.credentials ?? row?.credentials ?? {}) as Record<string, string>;
    if (!creds || Object.keys(creds).length === 0) {
      return json({ success: false, error: "Aucun identifiant enregistré pour cette plateforme" }, 400);
    }

    const result = await PROVIDERS[provider].verify(creds);

    await supabase
      .from("provider_credentials")
      .update({
        last_checked_at: new Date().toISOString(),
        last_check_ok: result.ok,
        last_check_error: result.ok ? null : result.error ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (!result.ok) {
      console.error(`verify ${provider} failed [${result.status}]: ${result.error}`);
      return json({ success: false, error: result.error, status: result.status }, 200);
    }
    return json({ success: true });
  } catch (err) {
    console.error("verify-provider error", err);
    return json({ success: false, error: err instanceof Error ? err.message : "Erreur inconnue" }, 500);
  }
});
