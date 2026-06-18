import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "Auto Seedance <noreply@autoseedance.site>";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { recipient_type, specific_email, subject, html_body, sent_by } = await req.json();

    if (!subject || !html_body) {
      return new Response(JSON.stringify({ error: "subject and html_body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailList: string[] = [];

    if (recipient_type === "all") {
      const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      emailList = data.users.map((u) => u.email!).filter(Boolean);
    } else if (recipient_type === "free") {
      const { data: subs } = await supabase.from("subscriptions").select("user_id").eq("plan", "free");
      const ids = subs?.map((s: any) => s.user_id) ?? [];
      const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      emailList = users.users
        .filter((u) => ids.includes(u.id))
        .map((u) => u.email!)
        .filter(Boolean);
    } else if (recipient_type === "paid") {
      const { data: subs } = await supabase.from("subscriptions").select("user_id").neq("plan", "free");
      const ids = subs?.map((s: any) => s.user_id) ?? [];
      const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      emailList = users.users
        .filter((u) => ids.includes(u.id))
        .map((u) => u.email!)
        .filter(Boolean);
    } else if (recipient_type === "specific" && specific_email) {
      emailList = [specific_email.trim()];
    }

    if (emailList.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send in batches of 50
    const batchSize = 50;
    let totalSent = 0;

    for (let i = 0; i < emailList.length; i += batchSize) {
      const batch = emailList.slice(i, i + batchSize);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: batch,
          subject,
          html: html_body,
        }),
      });

      if (res.ok) {
        totalSent += batch.length;
      } else {
        const err = await res.text();
        console.error("Resend batch error:", err);
      }
    }

    await supabase.from("email_campaigns").insert({
      subject,
      body_html: html_body,
      recipient_type,
      recipient_count: totalSent,
      sent_by: sent_by ?? null,
      status: "sent",
    });

    return new Response(JSON.stringify({ success: true, sent_count: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Campaign error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
