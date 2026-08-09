-- =====================================================================
-- 00032_security_and_integrity_fixes.sql
--
-- Fixes found during a full audit of the customer -> vendor -> operator
-- -> admin order flow:
--
--  1. CRITICAL: "Users can update own wallet" allowed any authenticated
--     user to UPDATE their own wallets row with ANY value (RLS only
--     checked row ownership, not which columns/values were being set).
--     A customer could run `update wallets set customer_balance = 999999999
--     where user_id = auth.uid()` from the client and mint free money.
--     Fix: remove direct client UPDATE access. All balance changes now
--     go exclusively through Edge Functions using the service-role key.
--
--  2. CRITICAL: "Users insert own transactions" let any user fabricate
--     fake transaction/receipt rows in their own history. Fix: remove
--     direct client INSERT access for the same reason as (1).
--
--  3. Add an atomic, race-condition-safe balance adjustment function.
--     Previously every Edge Function did read-balance -> compute ->
--     write-balance as three separate round trips, so two concurrent
--     requests (e.g. a customer double-tapping "Place Order", or two
--     Paystack webhook retries) could both read the same starting
--     balance and one update would clobber the other. A single SQL
--     UPDATE ... WHERE ... RETURNING is atomic per-row in Postgres and
--     closes that window.
--
--  4. Idempotency table for the Paystack webhook. The previous
--     check-then-insert idempotency check was itself racy (two webhook
--     deliveries arriving within milliseconds could both pass the
--     "not yet processed" check). A unique constraint + INSERT ...
--     ON CONFLICT DO NOTHING makes the claim atomic.
--
--  5. order_status_history — every status transition is now logged.
--     This replaces the previous "Avg Fulfillment Time" admin metric,
--     which was a random placeholder number
--     (`Math.round(18 + Math.random() * 7)`), with a real calculation.
--
--  6. packaging_fee column — the checkout screen already computed and
--     displayed a packaging fee and included it in the wallet-balance
--     check, but the amount was silently dropped by place-order and
--     never charged, never credited to the vendor, and never stored.
--     Column added so the fix in place-order/index.ts has somewhere
--     to persist it.
-- =====================================================================

-- ── 1 & 2. Remove insecure client-side wallet/transaction mutation ────
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users insert own transactions" ON public.transactions;

-- Wallet balances and transaction records are now exclusively written by
-- Edge Functions using the service-role key (which bypasses RLS), or by
-- the existing "Admin updates any wallet" / "Admin inserts transactions"
-- policies from 00030. Ordinary authenticated users retain read-only
-- access via the existing SELECT policies.

-- ── 3. Atomic wallet balance adjustment ────────────────────────────────
CREATE OR REPLACE FUNCTION public.adjust_wallet_balance(
  p_user_id UUID,
  p_column TEXT,          -- 'customer_balance' | 'vendor_balance'
  p_delta NUMERIC,        -- positive to credit, negative to debit
  p_require_sufficient BOOLEAN DEFAULT FALSE
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  IF p_column NOT IN ('customer_balance', 'vendor_balance') THEN
    RAISE EXCEPTION 'invalid_column: %', p_column;
  END IF;

  IF p_column = 'customer_balance' THEN
    IF p_require_sufficient THEN
      UPDATE wallets
        SET customer_balance = customer_balance + p_delta
        WHERE user_id = p_user_id
          AND customer_balance + p_delta >= 0
        RETURNING customer_balance INTO v_new_balance;
    ELSE
      UPDATE wallets
        SET customer_balance = customer_balance + p_delta
        WHERE user_id = p_user_id
        RETURNING customer_balance INTO v_new_balance;
    END IF;
  ELSE
    IF p_require_sufficient THEN
      UPDATE wallets
        SET vendor_balance = GREATEST(0, vendor_balance + p_delta)
        WHERE user_id = p_user_id
          AND vendor_balance + p_delta >= 0
        RETURNING vendor_balance INTO v_new_balance;
    ELSE
      UPDATE wallets
        SET vendor_balance = GREATEST(0, vendor_balance + p_delta)
        WHERE user_id = p_user_id
        RETURNING vendor_balance INTO v_new_balance;
    END IF;
  END IF;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_balance_or_wallet_not_found';
  END IF;

  RETURN v_new_balance;
END;
$$;

-- Only service_role (Edge Functions) needs to call this; it performs its
-- own authorization inside each function before touching money.
REVOKE ALL ON FUNCTION public.adjust_wallet_balance(UUID, TEXT, NUMERIC, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(UUID, TEXT, NUMERIC, BOOLEAN) TO service_role;

-- ── 4. Atomic idempotency claim table for payment webhooks ────────────
CREATE TABLE IF NOT EXISTS public.processed_payment_references (
  reference   TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.processed_payment_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages processed references"
  ON public.processed_payment_references FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 5. Missing order columns (added before the trigger below, which
--       references completed_at) ────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS packaging_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ── 6. Order status history (real fulfillment-time analytics) ─────────
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  changed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order parties can view status history"
  ON public.order_status_history FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE customer_id = auth.uid()
        OR vendor_id IN (SELECT id FROM vendors WHERE owner_id = auth.uid())
        OR runner_id = auth.uid()
        OR get_user_role(auth.uid()) IN ('Operator', 'Admin')
    )
  );

CREATE POLICY "Service role writes status history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Auto-log every status change (covers direct client updates by vendors/
-- operators via RLS-governed UPDATE, and edge-function updates via
-- service role) plus capture the very first "Pending" row on insert so
-- fulfillment time can be measured from creation, not just from the
-- first transition.
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
    IF NEW.status = 'Completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status_insert ON public.orders;
CREATE TRIGGER trg_log_order_status_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

DROP TRIGGER IF EXISTS trg_log_order_status_update ON public.orders;
CREATE TRIGGER trg_log_order_status_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- Backfill completed_at for already-completed historical orders so the
-- new analytics function has real data immediately (best effort — uses
-- created_at as a floor since we don't know the true completion time).
UPDATE public.orders
  SET completed_at = created_at
  WHERE status = 'Completed' AND completed_at IS NULL;
