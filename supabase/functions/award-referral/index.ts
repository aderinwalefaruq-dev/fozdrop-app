/**
 * award-referral Edge Function
 *
 * Called internally by place-order (service-role to service-role) after a
 * successful first order by a referred user.
 *
 * Body: { refereeId: string, orderId: string }
 *
 * Steps:
 *  1. Check referee exists and has a referred_by code
 *  2. Resolve referrer from referral_code
 *  3. Guard: only reward once per referee (referral_rewards UNIQUE on referee_id)
 *  4. Insert free_delivery_pass (24-hour expiry) for referrer
 *  5. Insert referral_rewards row
 *  6. Fire push notification to referrer
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
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { refereeId, orderId } = await req.json();
    if (!refereeId || !orderId) return json({ error: "Missing refereeId or orderId" }, 400);

    // 1. Load referee profile to get their referred_by code
    const { data: referee } = await svc
      .from("profiles")
      .select("id, referred_by")
      .eq("id", refereeId)
      .maybeSingle();

    if (!referee?.referred_by) return json({ skipped: "no referrer" });

    // 2. Resolve referrer from referral_code
    const { data: referrer } = await svc
      .from("profiles")
      .select("id")
      .eq("referral_code", referee.referred_by)
      .maybeSingle();

    if (!referrer) return json({ skipped: "referrer not found" });

    // 3. Guard: check this referee hasn't already been rewarded
    const { data: existing } = await svc
      .from("referral_rewards")
      .select("id")
      .eq("referee_id", refereeId)
      .maybeSingle();

    if (existing) return json({ skipped: "already rewarded" });

    // 4. Record the reward FIRST — this is the atomic dedup guard (unique
    // constraint on referee_id). The previous order (grant pass, then
    // record reward) had a race window: two near-simultaneous calls could
    // both pass the "already rewarded?" check above and both reach the
    // pass-insert step, granting the referrer two passes before the
    // second reward insert finally failed on the unique constraint.
    // Inserting the reward record first means only one caller can ever
    // win — the loser's insert fails immediately and grants no pass.
    const { error: rewardErr } = await svc.from("referral_rewards").insert({
      referrer_id: referrer.id,
      referee_id:  refereeId,
      order_id:    orderId,
    });

    if (rewardErr) {
      // Unique violation → another concurrent call already claimed this
      // referee's reward. Anything else is a genuine failure.
      if (rewardErr.code === "23505") return json({ skipped: "already rewarded" });
      console.error("award-referral: failed to record reward:", rewardErr);
      return json({ error: "Failed to record reward" }, 500);
    }

    // 5. Grant free delivery pass (24-hour expiry) — only reached once we
    // know this call uniquely owns the reward.
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await svc.from("free_delivery_passes").insert({
      user_id:    referrer.id,
      earned_from: refereeId,
      expires_at: expiresAt,
    });

    // 6. Push notification to referrer (non-blocking)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        targets: "user",
        userId:  referrer.id,
        title:   "Free Delivery Pass Earned! 🎉",
        body:    "Your friend just placed their first order on Fozdrop. You've earned 1 Free Delivery Pass (Valid for 24 hours)!",
        url:     "/(app)/(tabs)/profile",
      }),
    }).catch(() => {/* non-blocking */});

    console.log(`award-referral: pass granted to ${referrer.id} for referee ${refereeId}`);
    return json({ success: true, referrerId: referrer.id });

  } catch (err) {
    console.error("award-referral error:", err);
    return json({ error: String(err) }, 500);
  }
});
