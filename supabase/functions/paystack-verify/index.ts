import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Paystack fee formula (NGN):
 *   fee = 1.5% of gross_charge
 *   if gross_charge > ₦2,500 → add ₦100 flat cap
 *   fee is capped at ₦2,000
 *
 * Paystack verify response includes:
 *   amount           = gross amount charged to card (kobo) — includes fee
 *   requested_amount = net amount the merchant requested (kobo) — what customer intended to top up
 *   fees             = Paystack's actual fee (kobo)
 *
 * WALLET CREDIT = requested_amount (what the user intended to add)
 * FEE TRACKING  = fees field (actual Paystack charge)
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const { reference, userId } = await req.json();
    if (!reference || !userId) {
      return json({ error: 'reference and userId are required' }, 400);
    }

    // SECURITY: verify caller's JWT matches the target userId
    const token = authHeader.replace('Bearer ', '').trim();
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    
    const { data: { user }, error: callerErr } = await anonClient.auth.getUser();
    if (callerErr || !user || user.id !== userId) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) {
      return json({ error: 'Paystack not configured' }, 500);
    }

    // Verify transaction with Paystack API
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const data = await res.json();

    if (!data.status || data.data.status !== 'success') {
      return json({ error: 'Payment not successful', details: data.data?.gateway_response }, 400);
    }

    const txData = data.data;

    // Fee-correct calculations
    const netNaira = Number(txData.requested_amount ?? txData.amount) / 100;
    const feeNaira = Number(txData.fees ?? 0) / 100;
    const grossNaira = Number(txData.amount) / 100;

    console.log(`paystack-verify: ref=${reference} gross=₦${grossNaira} net=₦${netNaira} fee=₦${feeNaira}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Idempotency: claim this reference to prevent double-crediting
    const { error: claimErr } = await supabase
      .from('processed_payment_references')
      .insert({ reference });

    if (claimErr) {
      if (claimErr.code === '23505') {
        console.log(`paystack-verify: already processed ref=${reference}`);
        return json({ success: true, alreadyProcessed: true });
      }
      console.error('paystack-verify: failed to claim reference:', claimErr);
      return json({ error: 'Failed to process payment' }, 500);
    }

    const releaseClaim = () =>
      supabase.from('processed_payment_references').delete().eq('reference', reference);

    // Fetch user wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, fees_collected')
      .eq('user_id', userId)
      .maybeSingle();

    if (!wallet) {
      await releaseClaim();
      return json({ error: 'Wallet not found' }, 404);
    }

    // Atomic balance update
    const { data: newBalance, error: creditErr } = await supabase.rpc('adjust_wallet_balance', {
      p_user_id: userId,
      p_column: 'customer_balance',
      p_delta: netNaira,
      p_require_sufficient: false,
    });

    if (creditErr || newBalance === null) {
      console.error('paystack-verify: failed to credit wallet:', creditErr);
      await releaseClaim();
      return json({ error: 'Failed to credit wallet' }, 500);
    }

    // Track platform/paystack fee total
    await supabase
      .from('wallets')
      .update({ fees_collected: Number(wallet.fees_collected ?? 0) + feeNaira })
      .eq('user_id', userId);

    // Record credit transaction
    await supabase.from('transactions').insert({
      wallet_id: wallet.id,
      amount: netNaira,
      paystack_fee: feeNaira,
      transaction_type: 'Credit',
      reference_id: reference,
      description: `Wallet top-up ₦${netNaira.toLocaleString()} (fee ₦${feeNaira.toFixed(2)} paid by Paystack)`,
    });

    console.log(`paystack-verify: credited ₦${netNaira} to user ${userId} (fee ₦${feeNaira})`);
    return json({ success: true, amount: netNaira, fee: feeNaira });

  } catch (err) {
    console.error('paystack-verify error:', err);
    return json({ error: String(err) }, 500);
  }
});
