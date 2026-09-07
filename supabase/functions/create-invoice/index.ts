import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PROVIDERS, isProvider, InvoiceInput } from "../_shared/providers.ts";

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
    const invoice = body?.invoice as InvoiceInput | undefined;

    if (!isProvider(provider)) return json({ success: false, error: "Plateforme inconnue" }, 400);
    if (!invoice || !Array.isArray(invoice.items) || invoice.items.length === 0) {
      return json({ success: false, error: "Facture vide : ajoutez au moins une prestation" }, 400);
    }
    if (!invoice.clientName) return json({ success: false, error: "Le nom du client est obligatoire" }, 400);

    const { data: row } = await supabase
      .from("provider_credentials")
      .select("credentials")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .maybeSingle();

    const creds = (row?.credentials ?? {}) as Record<string, string>;
    if (!creds || Object.keys(creds).length === 0) {
      return json({ success: false, error: "Identifiants manquants pour cette plateforme" }, 400);
    }

    const result = await PROVIDERS[provider].create(creds, invoice);

    if (!result.ok) {
      console.error(`create ${provider} failed [${result.status}]: ${result.error}`);
      return json({ success: false, error: result.error, status: result.status }, 200);
    }

    return json({
      success: true,
      externalId: result.externalId ?? null,
      externalNumber: result.externalNumber ?? null,
      pdfUrl: result.pdfUrl ?? null,
    });
  } catch (err) {
    console.error("create-invoice error", err);
    return json({ success: false, error: err instanceof Error ? err.message : "Erreur inconnue" }, 500);
  }
});
