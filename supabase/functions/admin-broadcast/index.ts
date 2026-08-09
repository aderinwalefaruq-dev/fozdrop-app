/**
 * admin-broadcast Edge Function
 *
 * Sends a campus-wide announcement push notification.
 * Saves the announcement to DB then fires send-push per target audience.
 *
 * Body: { title, message, targetAudience: 'Customer'|'Vendor'|'Operator'|'All' }
 * Requires: caller must have role='Admin'
 */

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

const ROLES = ["Customer", "Vendor", "Operator"] as const;
type PushRole = typeof ROLES[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify Admin
    const { data: adminProfile } = await svc
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (adminProfile?.role !== "Admin") return json({ error: "Forbidden" }, 403);

    const { title, message, targetAudience } = await req.json();
    if (!title || !message || !targetAudience) {
      return json({ error: "Missing title, message, or targetAudience" }, 400);
    }

    // Save announcement to DB
    await svc.from("announcements").insert({
      title,
      message,
      target_audience: targetAudience,
      created_by: user.id,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Determine which roles to notify
    const targetRoles: PushRole[] =
      targetAudience === "All" ? [...ROLES] : [targetAudience as PushRole];

    // Fire push notifications per role (non-blocking)
    await Promise.allSettled(
      targetRoles.map((role) =>
        fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            targets: "role",
            role,
            title,
            body: message,
            url: "/(app)/(tabs)/home",
          }),
        })
      )
    );

    console.log(`admin-broadcast: announcement sent to ${targetAudience}`);
    return json({ success: true, targetAudience, rolesNotified: targetRoles });
  } catch (err) {
    console.error("admin-broadcast error:", err);
    return json({ error: String(err) }, 500);
  }
});
