import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Missing authorization.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_current_user_admin");
    if (adminError || !isAdmin) throw new Error("Admin access required.");

    const body = await req.json();
    const { registration_id } = body;
    if (!registration_id) throw new Error("registration_id is required.");

    const { data: row, error } = await supabase
      .from("registrations_admin_view")
      .select("*")
      .eq("id", registration_id)
      .single();
    if (error || !row) throw new Error("Registration not found.");

    const { data: ticket, error: ticketError } = await supabase.rpc("get_ticket_by_token", {
      p_token: body.ticket_lookup_token
    });
    if (ticketError) throw ticketError;

    const t = Array.isArray(ticket) ? ticket[0] : ticket;
    if (!t) throw new Error("Ticket could not be loaded.");

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const from = Deno.env.get("TICKET_FROM_EMAIL") || "Preserved Generation <tickets@example.com>";
    const appUrl = Deno.env.get("SITE_URL") || "";

    const { error: sendError } = await resend.emails.send({
      from,
      to: [row.email],
      subject: `Your Preserved Generation ticket — ${row.event_name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
          <h1>Preserved Generation</h1>
          <p>Hello ${escapeHtml(row.first_name)},</p>
          <p>Your registration has been confirmed.</p>
          <p><strong>Event:</strong> ${escapeHtml(row.event_name)}<br>
          <strong>Ticket:</strong> ${escapeHtml(row.ticket_code)}</p>
          ${appUrl ? `<p><a href="${appUrl}/success.html?token=${encodeURIComponent(body.ticket_lookup_token)}">Open your ticket</a></p>` : ""}
          <p>Please keep your ticket link safe and present the barcode at the entrance.</p>
        </div>`
    });
    if (sendError) throw sendError;
    return new Response(JSON.stringify({ ok: true, sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
function escapeHtml(v: string) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
}
