/**
 * admin-override Edge Function
 *
 * Handles order-level admin actions:
 *   - force_complete  : set order status to 'Completed'
 *   - force_cancel    : set order status to 'Cancelled'
 *   - refund          : credit full total_price back to customer wallet + log Refund txn
 *   - reassign_rider  : update runner_id on an active order
 *
 * Body: { action, orderId, runnerId? }
 * Requires: caller must have role='Admin' (verified via profiles lookup)
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

    // Verify caller is Admin
    const { data: profile } = await svc
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "Admin") return json({ error: "Forbidden" }, 403);

    const { action, orderId, runnerId } = await req.json();
    if (!orderId) return json({ error: "Missing orderId" }, 400);

    // Load order
    const { data: order } = await svc
      .from("orders")
      .select("id, customer_id, total_price, status, order_ref")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);

    if (action === "force_complete") {
      await svc.from("orders").update({ status: "Completed" }).eq("id", orderId);
      console.log(`admin-override: force_complete on order ${orderId}`);
      return json({ success: true });
    }

    if (action === "force_cancel") {
      await svc.from("orders").update({ status: "Cancelled" }).eq("id", orderId);
      console.log(`admin-override: force_cancel on order ${orderId}`);
      return json({ success: true });
    }

    if (action === "refund") {
      // Load customer wallet
      const { data: wallet } = await svc
        .from("wallets")
        .select("id")
        .eq("user_id", order.customer_id)
        .maybeSingle();
      if (!wallet) return json({ error: "Customer wallet not found" }, 404);

      const refRef = `REFUND-${order.order_ref}`;

      // Atomic credit — avoids the read-balance/write-balance race that
      // could lose money if a customer's balance changes concurrently
      // (e.g. they place another order at the same moment an admin issues
      // this refund).
      const { data: newBalance, error: creditErr } = await svc.rpc("adjust_wallet_balance", {
        p_user_id: order.customer_id,
        p_column: "customer_balance",
        p_delta: Number(order.total_price),
        p_require_sufficient: false,
      });
      if (creditErr || newBalance === null) {
        console.error("admin-override refund credit failed:", creditErr);
        return json({ error: "Failed to credit refund" }, 500);
      }

      await svc.from("transactions").insert({
        wallet_id: wallet.id,
        amount: Number(order.total_price),
        transaction_type: "Credit",
        reference_id: refRef,
        description: `Admin refund for order ${order.order_ref}`,
      });

      await svc.from("orders").update({ status: "Cancelled" }).eq("id", orderId);
      console.log(`admin-override: refund issued for order ${orderId}`);
      return json({ success: true, refRef });
    }

    if (action === "reassign_rider") {
      if (!runnerId) return json({ error: "Missing runnerId" }, 400);
      await svc.from("orders").update({ runner_id: runnerId }).eq("id", orderId);
      console.log(`admin-override: reassigned rider ${runnerId} to order ${orderId}`);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("admin-override error:", err);
    return json({ error: String(err) }, 500);
  }
});
