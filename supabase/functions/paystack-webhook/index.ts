import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
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
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Not configured" }, 500);

    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify Paystack signature (HMAC-SHA512)
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) return json({ error: "Missing signature" }, 401);

    const expectedSig = createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSig) {
      console.error("Paystack signature mismatch");
      return json({ error: "Invalid signature" }, 401);
    }

    const event = JSON.parse(rawBody);
    console.log("Paystack webhook event:", event.event);

    // Only handle successful charges
    if (event.event !== "charge.success") {
      return json({ received: true, skipped: true });
    }

    const { reference, customer, amount, status, requested_amount, fees } = event.data ?? {};

    if (status !== "success" || !reference || !customer?.email) {
      console.warn("Incomplete charge.success payload");
      return json({ received: true, skipped: true });
    }

    // ── Fee-correct amount calculation ───────────────────────────────────────
    // requested_amount = net amount user intended (no fee) — CREDIT THIS
    // fees             = actual Paystack processing fee — TRACK SEPARATELY
    // amount           = gross charged (requested_amount + fees) — DO NOT credit
    const netNaira   = Number(requested_amount ?? amount) / 100;
    const feeNaira   = Number(fees ?? 0) / 100;
    const grossNaira = Number(amount) / 100;

    console.log(`webhook charge.success: ref=${reference} gross=₦${grossNaira} net=₦${netNaira} fee=₦${feeNaira}`);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotency: atomically claim this reference before doing anything
    // else. The previous implementation did a SELECT to check for an
    // existing transaction and then an INSERT — two round trips with a
    // window in between where two near-simultaneous webhook deliveries
    // for the same reference (Paystack retries on any non-2xx, and can
    // also just send duplicates) could both pass the check and double-
    // credit the wallet. A single INSERT against a UNIQUE primary key is
    // atomic: only one caller can ever win the race.
    const { error: claimErr } = await svc
      .from("processed_payment_references")
      .insert({ reference });

    if (claimErr) {
      // Unique violation (Postgres code 23505) means another request
      // already claimed this reference — nothing more to do.
      if (claimErr.code === "23505") {
        console.log("Reference already processed (claim conflict):", reference);
        return json({ received: true, alreadyProcessed: true });
      }
      console.error("Failed to claim reference:", claimErr);
      return json({ error: "Failed to process webhook" }, 500);
    }

    // From here on, any early exit must release the claim we just took so
    // that Paystack's automatic retry (it retries on any non-2xx response)
    // can successfully credit the wallet once the transient problem
    // (e.g. user/wallet lookup failure) is resolved, instead of the
    // reference being permanently stuck as "already processed" with no
    // money ever credited.
    const releaseClaim = () =>
      svc.from("processed_payment_references").delete().eq("reference", reference);

    // Look up user by email
    const { data: usersData, error: userErr } = await svc.auth.admin.listUsers();
    if (userErr) {
      console.error("Failed to list users:", userErr);
      await releaseClaim();
      return json({ error: "Failed to resolve user" }, 500);
    }

    const user = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === customer.email.toLowerCase()
    );
    if (!user) {
      console.error("No user found for email:", customer.email);
      await releaseClaim();
      return json({ error: "User not found" }, 404);
    }

    // Get wallet
    const { data: wallet, error: walletErr } = await svc
      .from("wallets")
      .select("id, fees_collected")
      .eq("user_id", user.id)
      .maybeSingle();

    if (walletErr || !wallet) {
      console.error("Wallet not found for user:", user.id, walletErr);
      await releaseClaim();
      return json({ error: "Wallet not found" }, 404);
    }

    // Credit wallet with NET amount only (not gross) — atomic against any
    // concurrent balance change on the same wallet (e.g. an order being
    // placed at the same moment this webhook is processed).
    const { data: newBalance, error: creditErr } = await svc.rpc("adjust_wallet_balance", {
      p_user_id: user.id,
      p_column: "customer_balance",
      p_delta: netNaira,
      p_require_sufficient: false,
    });

    if (creditErr || newBalance === null) {
      console.error("Failed to credit wallet:", creditErr);
      await releaseClaim();
      return json({ error: "Failed to credit wallet" }, 500);
    }

    // fees_collected is an internal accounting figure (not spendable
    // balance), so a plain update is an acceptable trade-off here.
    await svc
      .from("wallets")
      .update({ fees_collected: Number(wallet.fees_collected ?? 0) + feeNaira })
      .eq("user_id", user.id);

    await svc.from("transactions").insert({
      wallet_id: wallet.id,
      amount: netNaira,
      paystack_fee: feeNaira,
      transaction_type: "Credit",
      reference_id: reference,
      description: `Wallet top-up ₦${netNaira.toLocaleString()} (fee ₦${feeNaira.toFixed(2)} paid by Paystack)`,
    });

    console.log(`webhook: credited ₦${netNaira} to user ${user.id} (fee ₦${feeNaira}, ref: ${reference})`);
    return json({ received: true, credited: netNaira, fee: feeNaira });
  } catch (err) {
    console.error("Webhook error:", err);
    return json({ error: String(err) }, 500);
  }
});
