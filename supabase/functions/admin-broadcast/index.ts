import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { title, message, body: msgBody, targetAudience, audience, target } = body;

    const broadcastTitle = title || "Announcement";
    const broadcastMessage = message || msgBody || "";
    const selectedAudience = targetAudience || audience || target || "All Users";

    // 1. Optionally save to DB (ignores table missing errors to prevent 500s)
    let announcementData = null;
    try {
      const { data } = await supabase
        .from("announcements")
        .insert([
          {
            title: broadcastTitle,
            message: broadcastMessage,
            target_audience: selectedAudience,
          },
        ])
        .select()
        .maybeSingle();
      announcementData = data;
    } catch (e) {
      console.warn("admin-broadcast: Optional database insert skipped:", e);
    }

    // 2. Map Target Audience for send-push
    let pushTargets = "role";
    let pushRole = "Customer";

    const audLower = selectedAudience.toLowerCase().trim();
    if (audLower.includes("all")) {
      pushTargets = "all";
      pushRole = "all";
    } else if (audLower.includes("customer")) {
      pushRole = "Customer";
    } else if (audLower.includes("vendor")) {
      pushRole = "Vendor";
    } else if (audLower.includes("rider") || audLower.includes("runner")) {
      pushRole = "Runner";
    }

    // 3. Trigger send-push Edge Function
    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        targets: pushTargets,
        role: pushRole,
        title: broadcastTitle,
        body: broadcastMessage,
        url: "/",
      }),
    });

    const pushResult = await pushResponse.json().catch(() => ({}));

    return json({
      success: true,
      announcement: announcementData,
      pushResult,
    });
  } catch (err) {
    console.error("admin-broadcast unhandled error:", err);
    return json({ error: String(err) }, 500);
  }
});