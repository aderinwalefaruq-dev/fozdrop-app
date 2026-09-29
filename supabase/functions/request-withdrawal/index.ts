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
    if (!token) return json({ error: "Unauthorized — no token" }, 401);

    const body = await req.json();
    const { amount } = body;

    // 1. Verify caller identity using JWT
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return json({ error: "Unauthorized" }, 401);
    }

    // 2. Initialize Service Role Client (Elevated Permissions)
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Fetch User Profile to verify Vendor role & get Name
    const { data: profile } = await svc
      .from("profiles")
      .select("name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role && profile.role !== "Vendor") {
      return json({ error: "Vendor role required" }, 403);
    }

    // 4. Validate Amount
    const withdrawAmount = Number(amount ?? 0);
    if (!withdrawAmount || withdrawAmount <= 0) return json({ error: "Enter a valid amount" }, 400);
    if (withdrawAmount < 500) return json({ error: "Minimum withdrawal is ₦500" }, 400);

    // 5. Flexible Wallet Lookup (checks user_id or primary key id)
    const { data: wallet } = await svc
      .from("wallets")
      .select("id, vendor_balance, balance")
      .or(`user_id.eq.${user.id},id.eq.${user.id}`)
      .maybeSingle();

    const available = Number(wallet?.vendor_balance ?? wallet?.balance ?? 0);

    if (!wallet || available < withdrawAmount) {
      return json({ 
        error: `Insufficient balance — available: ₦${available.toLocaleString('en-NG', { minimumFractionDigits: 2 })}` 
      }, 400);
    }

    // 6. Fetch Bank Details
    const { data: bankDetails } = await svc
      .from("bank_details")
      .select("bank_name, account_number, account_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!bankDetails) return json({ error: "Please save your bank details before requesting a withdrawal" }, 400);

    // 7. Deduct balance atomically
    const { data: balanceAfterDebit, error: balErr } = await svc.rpc("adjust_wallet_balance", {
      p_user_id: user.id,
      p_column: "vendor_balance",
      p_delta: -withdrawAmount,
      p_require_sufficient: true,
    });

    if (balErr || balanceAfterDebit === null) {
      console.error("Balance deduction error:", balErr?.message ?? "insufficient balance at commit time");
      return json({ error: "Insufficient balance — please refresh and try again" }, 400);
    }

    // 8. Insert withdrawal request
    const { data: wdReq, error: wdErr } = await svc
      .from("withdrawal_requests")
      .insert({
        vendor_id: user.id,
        amount: withdrawAmount,
        bank_name: bankDetails.bank_name,
        account_number: bankDetails.account_number,
        account_name: bankDetails.account_name,
        status: "Approved",
      })
      .select("id")
      .maybeSingle();

    if (wdErr || !wdReq) {
      console.error("Insert error:", wdErr);
      // Compensate: refund reserved balance
      await svc.rpc("adjust_wallet_balance", {
        p_user_id: user.id,
        p_column: "vendor_balance",
        p_delta: withdrawAmount,
        p_require_sufficient: false,
      });
      return json({ error: "Failed to create request" }, 500);
    }

    // 9. Record Debit Transaction
    const { error: txErr } = await svc.from("transactions").insert({
      wallet_id: wallet.id,
      amount: withdrawAmount,
      transaction_type: "Debit",
      reference_id: wdReq.id,
      description: `Withdrawal request: ₦${withdrawAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
    });
    if (txErr) console.error("Transaction insert error:", txErr.message);

    // 10. Send Email Notification via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const vendorName = profile?.name ?? user.email ?? "Unknown Vendor";

    if (resendKey) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Fozdrop Notifications <onboarding@resend.dev>",
          to: ["aderinwalefaruq@gmail.com"],
          subject: `💸 Withdrawal Request — ${vendorName} (₦${withdrawAmount.toLocaleString()})`,
          html: `
            <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #eee">
              <div style="background:#F25C19;padding:20px 24px;border-radius:8px;margin-bottom:24px">
                <h2 style="color:#fff;margin:0;font-size:20px">💸 Withdrawal Request</h2>
                <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px">A vendor has requested a manual payout</p>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr style="background:#f9f9f9"><td style="padding:10px 14px;font-weight:700;width:40%">Vendor Name</td><td style="padding:10px 14px">${vendorName}</td></tr>
                <tr><td style="padding:10px 14px;font-weight:700">Email</td><td style="padding:10px 14px">${user.email}</td></tr>
                <tr style="background:#f9f9f9"><td style="padding:10px 14px;font-weight:700">Amount</td><td style="padding:10px 14px;color:#F25C19;font-weight:800;font-size:18px">₦${withdrawAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td style="padding:10px 14px;font-weight:700">Bank Name</td><td style="padding:10px 14px">${bankDetails.bank_name}</td></tr>
                <tr style="background:#f9f9f9"><td style="padding:10px 14px;font-weight:700">Account Number</td><td style="padding:10px 14px;font-family:monospace;font-size:15px;letter-spacing:1px">${bankDetails.account_number}</td></tr>
                <tr><td style="padding:10px 14px;font-weight:700">Account Name</td><td style="padding:10px 14px">${bankDetails.account_name}</td></tr>
                <tr style="background:#f9f9f9"><td style="padding:10px 14px;font-weight:700">Request ID</td><td style="padding:10px 14px;font-family:monospace;font-size:12px">${wdReq.id}</td></tr>
              </table>
              <div style="background:#fff8f0;border:1px solid #fed7aa;border-radius:8px;padding:14px;margin-top:20px">
                <p style="margin:0;font-size:13px;color:#92400e">
                  ⚡ Please transfer this amount manually within <strong>24 hours</strong>. The vendor's balance has already been deducted by this amount.
                </p>
              </div>
              <p style="color:#888;font-size:11px;margin-top:20px;text-align:center">Fozdrop Delivery · Bells University Campus</p>
            </div>
          `,
        }),
      });
      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.warn("Resend email failed:", errText);
      }
    }

    return json({ success: true, requestId: wdReq.id });
  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ error: String(err) }, 500);
  }
});