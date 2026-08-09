/**
 * admin-award-credits Edge Function
 *
 * Awards wallet credits or free delivery passes to a customer.
 *
 * Body: { targetUserId, type: 'credits'|'passes', amount: number }
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

    const { targetUserId, type, amount } = await req.json();
    if (!targetUserId || !type || !amount || amount <= 0) {
      return json({ error: "Missing or invalid fields" }, 400);
    }

    if (type === "credits") {
      const { data: wallet } = await svc
        .from("wallets")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (!wallet) return json({ error: "Target wallet not found" }, 404);

      // Atomic credit — see adjust_wallet_balance (migration 00032) for why
      // a plain read-then-write update is unsafe here.
      const { data: newBalance, error: creditErr } = await svc.rpc("adjust_wallet_balance", {
        p_user_id: targetUserId,
        p_column: "customer_balance",
        p_delta: Number(amount),
        p_require_sufficient: false,
      });
      if (creditErr || newBalance === null) {
        console.error("admin-award-credits credit failed:", creditErr);
        return json({ error: "Failed to award credit" }, 500);
      }

      const ref = `AWARD-${Date.now().toString(36).toUpperCase()}`;
      await svc.from("transactions").insert({
        wallet_id: wallet.id,
        amount: Number(amount),
        transaction_type: "Credit",
        reference_id: ref,
        description: `Admin award: ₦${amount} wallet credit`,
      });
      console.log(`admin-award-credits: ₦${amount} awarded to ${targetUserId}`);
      return json({ success: true, ref });
    }

    if (type === "passes") {
      const passCount = Math.floor(Number(amount));
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const rows = Array.from({ length: passCount }, () => ({
        user_id: targetUserId,
        earned_from: user.id,
        expires_at: expiresAt,
      }));
      await svc.from("free_delivery_passes").insert(rows);
      console.log(`admin-award-credits: ${passCount} pass(es) awarded to ${targetUserId}`);
      return json({ success: true, passesAwarded: passCount });
    }

    return json({ error: "Unknown type" }, 400);
  } catch (err) {
    console.error("admin-award-credits error:", err);
    return json({ error: String(err) }, 500);
  }
});
