# Fozdrop — Full Order-Flow Audit & Fix Report

This document lists every bug found and fixed during a line-by-line audit of
the app, covering login/registration → cart → checkout → place-order →
vendor → operator → admin → cancel/complete. It's organized by severity so
you can see what mattered most.

All changes are in this zip already. The only thing you need to do is
**run the new migration** (`supabase/migrations/00032_security_and_integrity_fixes.sql`)
against your Supabase project — everything else is plain code.

---

## 🔴 Critical security bugs (fixed)

1. **Any signed-in user could mint themselves unlimited wallet balance.**
   The `wallets` table's Row Level Security policy allowed any authenticated
   user to `UPDATE` their own row with *any* value — RLS only checked who
   owned the row, not which columns or values were being written. A
   customer could open dev tools and run
   `supabase.from('wallets').update({ customer_balance: 999999999 })`
   and it would succeed.
   **Fix:** removed that policy (migration `00032`). Wallet balances are
   now writable only by Edge Functions using the service-role key.

2. **Any signed-in user could fabricate fake transaction history.**
   Same root cause as #1, on the `transactions` table's INSERT policy.
   **Fix:** removed in the same migration.

3. **Two dead-but-dangerous client functions relied on the holes above:**
   `topUpWallet()` and `withdrawVendorBalance()` in `src/db/api.ts` wrote
   directly to `wallets` from the client. They weren't wired into any
   screen, but they were a landmine for a future dev to accidentally call.
   **Fix:** removed both, with comments explaining why and pointing to the
   correct (server-verified) paths.

4. **Any Vendor could cancel any other vendor's orders.**
   `cancel-order` checked `role === 'Vendor'` but never checked that the
   caller actually *owned* the vendor store the order belonged to.
   **Fix:** added an ownership check before allowing a Vendor-role caller
   to cancel. Operators (campus-wide staff) are unaffected.

5. **A top-up could be redirected into the wrong wallet.**
   `paystack-verify` checked that *a* valid token was present, but never
   verified that the caller was actually the `userId` being credited. Since
   payment references aren't secret, anyone who saw a reference (e.g. by
   racing the legitimate owner's client) could credit it to their own
   account instead.
   **Fix:** now verifies `caller.id === userId` before crediting, matching
   the pattern already used correctly in `place-order` and `cancel-order`.

---

## 🟠 Money-correctness / race-condition bugs (fixed)

Every function that moves money (`place-order`, `cancel-order`,
`buy-delivery-pass`, `request-withdrawal`, `paystack-webhook`,
`paystack-verify`, `admin-override`, `admin-award-credits`) used the same
unsafe pattern: **read the balance → compute in JS → write the balance**,
as three separate network round trips. Two requests arriving close together
(a double-tap on "Place Order", two Paystack webhook retries, a customer
placing an order at the exact moment an admin issues a refund, etc.) could
both read the same starting balance and the second write would silently
clobber the first — money could be lost or, in the debit direction, a
wallet could be overdrawn.

**Fix:** added one atomic SQL function, `adjust_wallet_balance()`
(a single `UPDATE ... WHERE ... RETURNING`, which Postgres guarantees is
atomic per row), and rewired all eight functions above to use it instead of
read-then-write. Debit paths also pass `p_require_sufficient: true` so the
sufficiency check happens at the database level, not against a
possibly-stale number read a moment earlier.

6. **Paystack webhook could double-credit a wallet.** The idempotency check
   was itself a check-then-insert race — two near-simultaneous webhook
   deliveries for the same reference could both pass the "not yet
   processed" check. **Fix:** replaced with an atomic claim via a new
   `processed_payment_references` table with a `PRIMARY KEY` on the
   reference — only one caller can ever win the insert.

7. **`paystack-verify` and `paystack-webhook` had two separate,
   inconsistent idempotency mechanisms** for the same class of payment
   (one checked `transactions.reference_id`, the other now checks the new
   claim table). Since both paths can legitimately fire for the same
   payment, they now share the *same* atomic claim table so neither can
   double-credit after the other has already paid out.

8. **Referral rewards could double-grant a free pass.** `award-referral`
   granted the pass first, then recorded the dedup guard row — so a race
   between two concurrent calls could grant two passes before the second
   guard-row insert finally failed. **Fix:** reordered so the dedup insert
   happens first; the pass is only granted once that insert is confirmed
   to be uniquely owned by this call.

9. **Admin refund used an invalid transaction type.** `admin-override`'s
   refund action inserted `transaction_type: "Refund"`, but the database's
   `CHECK` constraint only allows `'Debit'` or `'Credit'` — so every admin
   refund's transaction record silently failed to save (the refund itself
   still worked, but it never showed up in transaction history).
   **Fix:** changed to `"Credit"`, matching the working refund path in
   `cancel-order`.

---

## 🟡 Broken / incomplete features (fixed)

10. **Packaging fee was charged to nobody.** The checkout screen computed
    a packaging fee, displayed it, and included it in the wallet-balance
    check — but `place-order` silently dropped the field. Customers were
    never actually charged for packaging, and vendors were never paid for
    it, even though the UI implied both.
    **Fix:** added a `packaging_fee` column to `orders`; `place-order` now
    reads the per-vendor `packagingRequested` flag, charges the customer,
    credits the vendor, and stores it on the order. Vendor and customer
    order cards now show the packaging portion. Cancellation now reverses
    it correctly too.

11. **`runner_id` was never set anywhere**, so any admin/analytics view
    meant to show "which operator delivered this order" was always blank.
    **Fix:** `updateOrderStatus` now accepts an optional `runnerId`, and
    the Operator screen passes the current operator's ID whenever they
    advance an order's status.

12. **Admin's "Avg. Order Fulfillment Time" was fake data.** The function
    literally returned `Math.round(18 + Math.random() * 7)` — a random
    number in a plausible range, shown to admins as if it were a real
    metric.
    **Fix:** added an `order_status_history` table (populated by a
    trigger on every status change) and a `completed_at` column on
    `orders`, then rewrote the function to calculate a real average from
    actual order timestamps. Also fixed a **unit bug** hiding underneath
    the fake data: the function was named `...Ms` (milliseconds) but the
    UI displayed its return value directly as `"{value} min"` — the old
    fake number happened to already be in the 18–25 range so nobody
    noticed the units never matched. Renamed to
    `getAdminAvgFulfillmentMinutes` and it now genuinely returns minutes.

13. **Misleading copy in the vendor withdrawal flow.** Both the in-app
    modal and the admin notification email said the vendor's balance
    "won't change" / "will remain unchanged" until the transfer is
    manually confirmed — but the code (both before and after this audit)
    actually reserves/deducts the balance immediately on request.
    **Fix:** corrected both messages to describe what the app actually
    does.

---

## 🔵 Smaller correctness fixes

- Removed a redundant extra database round-trip in `request-withdrawal`
  (it re-fetched the wallet a second time just to get `id`, which was
  already available from the first fetch).
- `paystack-initialize` now requires authentication and rejects
  zero/negative amounts (previously anyone, signed in or not, could call
  it to generate arbitrary Paystack payment links).

---

## What was reviewed and found clean

Auth/session context (`ctx.tsx`), cart logic (`CartContext.tsx`),
registration (`register-user` — role whitelist correctly excludes `Admin`
server-side), password reset (`reset-password` — good anti-enumeration and
rate-limiting), `admin-broadcast`, `set-app-status`, the customer wallet
screen's top-up/recovery flow, and all of the RLS policies on `vendors`,
`menus`, `menu_sections`, `bank_details`, `withdrawal_requests`,
`free_delivery_passes`, `referral_rewards`, and `push_subscriptions` — these
were already correctly scoped with proper `WITH CHECK` clauses or
service-role-only access.

---

## Migration to run

```
supabase/migrations/00032_security_and_integrity_fixes.sql
```

This is additive and safe to run on an existing database — it only drops
two overly-permissive policies, adds a function, two new tables, and two
new nullable/defaulted columns on `orders`. No existing data is altered
except a one-time best-effort backfill of `completed_at` for orders that
are already `Completed`.
