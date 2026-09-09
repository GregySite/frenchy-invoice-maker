import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim().slice(0, 40) : '';

    if (!name || name.length > 120 || !message || message.length > 4000) {
      return new Response(JSON.stringify({ error: 'Nom ou message invalide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let userId: string | null = null;
    let userEmail: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = data.user?.id ?? null;
      userEmail = data.user?.email ?? null;
    }

    await supabase.from('contact_messages').insert({
      user_id: userId,
      name,
      email: userEmail,
      phone: phone || null,
      message,
    });

    const adminEmail = Deno.env.get('ADMIN_CONTACT_EMAIL');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');

    if (adminEmail && resendKey && lovableKey) {
      const html = `
        <h2>Nouveau message depuis Ma Compta Link</h2>
        <p><strong>Nom :</strong> ${name}</p>
        <p><strong>Email du compte :</strong> ${userEmail ?? '—'}</p>
        <p><strong>Téléphone :</strong> ${phone || '—'}</p>
        <p><strong>Message :</strong></p>
        <p>${message.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p>
      `;
      const res = await fetch(`${GATEWAY_URL}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lovableKey}`,
          'X-Connection-Api-Key': resendKey,
        },
        body: JSON.stringify({
          from: 'Ma Compta Link <onboarding@resend.dev>',
          to: [adminEmail],
          reply_to: userEmail ?? undefined,
          subject: `Demande d'activation — ${name}`,
          html,
        }),
      });
      if (!res.ok) {
        const details = await res.text();
        console.error(`Resend failed [${res.status}]: ${details}`);
        return new Response(JSON.stringify({ saved: true, emailed: false, status: res.status, details }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ saved: true, emailed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ saved: true, emailed: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('contact-admin error', e);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
