/**
 * buy-delivery-pass Edge Function
 *
 * Allows a customer to purchase 1 Free Delivery Pass for ₦200 from their wallet.
 *
 * Body: { customerId: string }
 *
 * Steps:
 *  1. Authenticate the caller and verify customerId matches
 *  2. Check customer wallet has >= ₦200
 *  3. Deduct ₦200 from customer_balance
 *  4. Insert debit transaction record
 *  5. Insert free_delivery_pass (24-hour expiry, earned_from = 'purchase')
 *  6. Credit platform wallet with ₦200
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PASS_PRICE = 200; // ₦200

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { customerId } = await req.json();
    if (!customerId) return json({ error: "Missing customerId" }, 400);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user || user.id !== customerId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Check wallet balance
    const { data: wallet, error: walletErr } = await svc
      .from("wallets")
      .select("id, customer_balance")
      .eq("user_id", customerId)
      .maybeSingle();

    if (walletErr || !wallet) {
      return json({ error: "Could not load wallet" }, 500);
    }
    if (Number(wallet.customer_balance) < PASS_PRICE) {
      return json({ error: `Insufficient balance. You need ₦${PASS_PRICE} to buy a pass.` }, 400);
    }

    const ref = `PASS-${Date.now().toString(36).toUpperCase()}`;

    // 3. Deduct ₦200 — atomic + re-checks sufficiency at the DB level so a
    // double-tap or concurrent purchase can't overdraw the wallet.
    const { data: balanceAfterDeduct, error: deductErr } = await svc.rpc("adjust_wallet_balance", {
      p_user_id: customerId,
      p_column: "customer_balance",
      p_delta: -PASS_PRICE,
      p_require_sufficient: true,
    });

    if (deductErr || balanceAfterDeduct === null) {
      return json({ error: "Failed to deduct balance — insufficient funds" }, 400);
    }

    // 4. Debit transaction
    await svc.from("transactions").insert({
      wallet_id: wallet.id,
      amount: PASS_PRICE,
      transaction_type: "Debit",
      reference_id: ref,
      description: `Purchased Free Delivery Pass: ${ref}`,
    });

    // 5. Insert pass (24-hour expiry, earned_from marks as 'purchased')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: passErr } = await svc.from("free_delivery_passes").insert({
      user_id:     customerId,
      earned_from: "purchase",
      expires_at:  expiresAt,
    });

    if (passErr) {
      // Rollback wallet deduction — credit the exact amount back atomically
      // rather than resetting to the balance we read earlier, which could
      // now be stale and clobber a concurrent, unrelated change.
      await svc.rpc("adjust_wallet_balance", {
        p_user_id: customerId,
        p_column: "customer_balance",
        p_delta: PASS_PRICE,
        p_require_sufficient: false,
      });
      return json({ error: "Failed to create pass" }, 500);
    }

    // 6. Credit platform wallet
    const { data: platformSetting } = await svc
      .from("app_settings")
      .select("value")
      .eq("key", "platform_owner_user_id")
      .maybeSingle();

    if (platformSetting?.value) {
      const { data: ownerWallet } = await svc
        .from("wallets")
        .select("id")
        .eq("user_id", platformSetting.value)
        .maybeSingle();

      if (ownerWallet) {
        await svc.rpc("adjust_wallet_balance", {
          p_user_id: platformSetting.value,
          p_column: "vendor_balance",
          p_delta: PASS_PRICE,
          p_require_sufficient: false,
        });

        await svc.from("transactions").insert({
          wallet_id: ownerWallet.id,
          amount: PASS_PRICE,
          transaction_type: "Credit",
          reference_id: ref,
          description: `Pass purchase revenue: ${ref}`,
        });
      }
    }

    console.log(`buy-delivery-pass: pass purchased by ${customerId}, ref ${ref}`);
    return json({ success: true, ref, expiresAt });

  } catch (err) {
    console.error("buy-delivery-pass error:", err);
    return json({ error: String(err) }, 500);
  }
});
