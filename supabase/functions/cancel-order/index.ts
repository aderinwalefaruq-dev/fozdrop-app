import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body first (stream can only be read once)
    const body = await req.json();
    const { order_id } = body;
    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is Vendor or Operator
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: profile } = await anonClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "Vendor" && profile?.role !== "Operator") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Vendor or Operator role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for all mutations — bypasses RLS
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the order with stored subtotal to avoid recomputing
    const { data: order, error: orderErr } = await svc
      .from("orders")
      .select("id, customer_id, vendor_id, total_price, subtotal, delivery_fee, packaging_fee, order_ref, status")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr || !order) {
      console.error("Order fetch error:", orderErr);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: a Vendor may only cancel orders that belong to their own
    // store. Without this check, any authenticated Vendor could cancel
    // (and trigger a refund/reversal for) any other vendor's orders,
    // since this function runs with the service-role key and bypasses
    // RLS. Operators are campus-wide staff and may cancel any order.
    if (profile.role === "Vendor") {
      const { data: ownedVendor } = await svc
        .from("vendors")
        .select("id")
        .eq("id", order.vendor_id)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!ownedVendor) {
        return new Response(
          JSON.stringify({ error: "Forbidden: you can only cancel your own store's orders" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (order.status === "Cancelled" || order.status === "Completed") {
      return new Response(
        JSON.stringify({ error: `Order is already ${order.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Mark order as Cancelled
    const { error: cancelErr } = await svc
      .from("orders")
      .update({ status: "Cancelled" })
      .eq("id", order_id);
    if (cancelErr) {
      console.error("Cancel update error:", cancelErr);
      return new Response(
        JSON.stringify({ error: "Failed to cancel order: " + cancelErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Refund customer — credit full total_price back (atomic; race-safe
    // against any concurrent balance change, e.g. a second cancellation
    // request or an in-flight order placement).
    const { data: customerWallet } = await svc
      .from("wallets")
      .select("id")
      .eq("user_id", order.customer_id)
      .maybeSingle();

    if (customerWallet) {
      await svc.rpc("adjust_wallet_balance", {
        p_user_id: order.customer_id,
        p_column: "customer_balance",
        p_delta: Number(order.total_price),
        p_require_sufficient: false,
      });

      await svc.from("transactions").insert({
        wallet_id: customerWallet.id,
        amount: order.total_price,
        transaction_type: "Credit",
        reference_id: order.order_ref,
        description: `Refund for cancelled order: ${order.order_ref}`,
      });
    }

    // 3. Reverse vendor credit — debit the stored subtotal + packaging fee back
    const { data: vendorData } = await svc
      .from("vendors")
      .select("owner_id")
      .eq("id", order.vendor_id)
      .maybeSingle();

    if (vendorData?.owner_id) {
      const { data: vendorWallet } = await svc
        .from("wallets")
        .select("id")
        .eq("user_id", vendorData.owner_id)
        .maybeSingle();

      if (vendorWallet) {
        const reversalAmount = Number(order.subtotal) + Number(order.packaging_fee ?? 0);
        await svc.rpc("adjust_wallet_balance", {
          p_user_id: vendorData.owner_id,
          p_column: "vendor_balance",
          p_delta: -reversalAmount,
          p_require_sufficient: false, // clamped to 0 inside the function — never goes negative
        });

        await svc.from("transactions").insert({
          wallet_id: vendorWallet.id,
          amount: reversalAmount,
          transaction_type: "Debit",
          reference_id: order.order_ref,
          description: `Order cancellation reversal: ${order.order_ref}`,
        });
      }
    }

    // 4. Reverse platform delivery fee
    const { data: platformSetting } = await svc
      .from("app_settings")
      .select("value")
      .eq("key", "platform_owner_user_id")
      .maybeSingle();

    if (platformSetting?.value && Number(order.delivery_fee) > 0) {
      const { data: ownerWallet } = await svc
        .from("wallets")
        .select("id")
        .eq("user_id", platformSetting.value)
        .maybeSingle();

      if (ownerWallet) {
        await svc.rpc("adjust_wallet_balance", {
          p_user_id: platformSetting.value,
          p_column: "vendor_balance",
          p_delta: -Number(order.delivery_fee),
          p_require_sufficient: false,
        });

        await svc.from("transactions").insert({
          wallet_id: ownerWallet.id,
          amount: order.delivery_fee,
          transaction_type: "Debit",
          reference_id: order.order_ref,
          description: `Delivery fee reversal (cancellation): ${order.order_ref}`,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
