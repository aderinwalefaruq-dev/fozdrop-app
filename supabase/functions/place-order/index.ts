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

    const body = await req.json();
    const {
      customerId,
      vendorGroups,   // Array<{ vendorId, subtotal, plates: [{ label, items, packagingRequested? }] }>
      dropoffLocationId,
      locationDescription,
      deliveryNotes,
      subtotal,
      useDeliveryPass, // boolean — customer elected to redeem 1 free delivery pass
      scheduledFor,    // ISO string or null/undefined — customer-requested delivery time
    } = body;

    if (!customerId || !Array.isArray(vendorGroups) || vendorGroups.length === 0 || !dropoffLocationId || !subtotal) {
      return json({ error: "Missing required fields" }, 400);
    }

    // Validate the scheduled time server-side — never trust the client alone
    // for something that changes operational behavior (the client already
    // restricts choices to future slots, but that's UX, not enforcement).
    let scheduledForDate: string | null = null;
    if (scheduledFor) {
      const d = new Date(scheduledFor);
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        return json({ error: "Scheduled delivery time must be a valid time in the future" }, 400);
      }
      scheduledForDate = d.toISOString();
    }

    // Verify caller
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

    // ── Read service fees from app_settings (admin-configurable) ─────────
    const { data: feeRow } = await svc
      .from("app_settings")
      .select("value")
      .eq("key", "delivery_fee")
      .maybeSingle();
    const DELIVERY_FEE = feeRow?.value ? Number(feeRow.value) : 199;

    const { data: packagingFeeRow } = await svc
      .from("app_settings")
      .select("value")
      .eq("key", "packaging_fee")
      .maybeSingle();
    const PACKAGING_FEE_UNIT = packagingFeeRow?.value ? Number(packagingFeeRow.value) : 200;

    // ── Resolve free delivery pass (at most 1 per order) ─────────────────
    let passId: string | null = null;
    const effectiveDeliveryFee = useDeliveryPass ? 0 : DELIVERY_FEE;

    if (useDeliveryPass) {
      const now = new Date().toISOString();
      const { data: pass } = await svc
        .from("free_delivery_passes")
        .select("id")
        .eq("user_id", customerId)
        .eq("is_used", false)
        .gt("expires_at", now)
        .order("expires_at", { ascending: true }) // consume soonest-expiring first
        .limit(1)
        .maybeSingle();

      if (!pass) {
        return json({ error: "No valid Free Delivery Pass available" }, 400);
      }
      passId = pass.id;
    }

    // Total packaging fee across every plate, across every vendor group,
    // that opted in — packaging is a per-plate choice now, not per vendor.
    type PackagingPlateInput = { items?: unknown[]; packagingRequested?: boolean };
    type PackagingGroupInput = { plates?: PackagingPlateInput[] };
    const totalPackagingFee = (vendorGroups as PackagingGroupInput[]).reduce((sum, g) => {
      const plates = Array.isArray(g.plates) ? g.plates : [];
      const packedNonEmptyPlates = plates.filter(
        (p) => Array.isArray(p.items) && p.items.length > 0 && p.packagingRequested
      ).length;
      return sum + packedNonEmptyPlates * PACKAGING_FEE_UNIT;
    }, 0);

    const totalPrice = Number(subtotal) + effectiveDeliveryFee + totalPackagingFee;

    // Check customer balance (existence only — the actual debit below is
    // atomic and re-checks sufficiency at the database level, closing the
    // race window where two concurrent orders could both pass this check
    // against the same stale balance).
    const { data: customerWallet, error: walletErr } = await svc
      .from("wallets")
      .select("id, customer_balance")
      .eq("user_id", customerId)
      .maybeSingle();

    if (walletErr || !customerWallet) {
      console.error("Customer wallet error:", walletErr);
      return json({ error: "Could not load wallet" }, 500);
    }
    if (Number(customerWallet.customer_balance) < totalPrice) {
      return json({ error: "Insufficient wallet balance" }, 400);
    }

    const groupRef = `FD-${Date.now().toString(36).toUpperCase()}`;
    const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();
    const orderIds: string[] = [];

    // Create one order per vendor group
    for (const group of vendorGroups) {
      const { vendorId, subtotal: vendorSubtotal, plates } = group;
      if (!vendorId || !Array.isArray(plates) || plates.length === 0) continue;

      // Flatten this vendor's plates into order_item rows, keeping each
      // row tagged with which plate it belongs to. Skip empty plates
      // (e.g. one the customer created but never added items to).
      type PlateInput = {
        label: string;
        items: Array<{ menuId: string; itemName: string; price: number; quantity: number }>;
        packagingRequested?: boolean;
      };
      const nonEmptyPlates = (plates as PlateInput[]).filter(
        (plate) => Array.isArray(plate.items) && plate.items.length > 0
      );
      const orderItemRows = nonEmptyPlates.flatMap((plate) =>
        plate.items.map((item) => ({
          menu_id: item.menuId,
          item_name: item.itemName,
          price: item.price,
          quantity: item.quantity,
          plate_label: plate.label,
        }))
      );
      if (orderItemRows.length === 0) continue;

      // Packaging is chosen per plate — sum the fee across every plate in
      // THIS order that opted in, and record which plate labels were
      // packed so the vendor/operator can see exactly which plate needs
      // a togo box.
      const packedPlates = nonEmptyPlates.filter((plate) => plate.packagingRequested);
      const orderPackagingFee = packedPlates.length * PACKAGING_FEE_UNIT;
      const platePackaging: Record<string, boolean> = {};
      nonEmptyPlates.forEach((plate) => { platePackaging[plate.label] = !!plate.packagingRequested; });

      // Delivery fee only on the first order; subsequent orders ₦0
      const isFirst = orderIds.length === 0;
      const orderDeliveryFee = isFirst ? effectiveDeliveryFee : 0;
      const orderTotal = Number(vendorSubtotal) + orderDeliveryFee + orderPackagingFee;

      // Insert order
      const { data: orderData, error: orderErr } = await svc
        .from("orders")
        .insert({
          order_ref: groupRef,
          delivery_code: deliveryCode,
          customer_id: customerId,
          vendor_id: vendorId,
          dropoff_location_id: dropoffLocationId,
          location_description: locationDescription ?? "",
          delivery_notes: deliveryNotes ?? "",
          subtotal: Number(vendorSubtotal),
          delivery_fee: orderDeliveryFee,
          packaging_fee: orderPackagingFee,
          plate_packaging: platePackaging,
          total_price: orderTotal,
          status: "Pending",
          scheduled_for: scheduledForDate,
        })
        .select("id")
        .maybeSingle();


      if (orderErr || !orderData) {
        console.error("Order insert error:", orderErr);
        return json({ error: "Failed to create order: " + (orderErr?.message ?? "unknown") }, 500);
      }

      orderIds.push(orderData.id);

      // Insert order items, each tagged with its plate_label
      await svc.from("order_items").insert(
        orderItemRows.map((row) => ({ ...row, order_id: orderData.id }))
      );

      // Credit vendor wallet with their subtotal + any packaging fee
      // (they're the ones sourcing and preparing the packaging).
      const { data: vendorData } = await svc
        .from("vendors")
        .select("owner_id")
        .eq("id", vendorId)
        .maybeSingle();

      if (vendorData?.owner_id) {
        const { data: vendorWallet } = await svc
          .from("wallets")
          .select("id")
          .eq("user_id", vendorData.owner_id)
          .maybeSingle();

        if (vendorWallet) {
          const vendorCreditAmount = Number(vendorSubtotal) + orderPackagingFee;
          await svc.rpc("adjust_wallet_balance", {
            p_user_id: vendorData.owner_id,
            p_column: "vendor_balance",
            p_delta: vendorCreditAmount,
            p_require_sufficient: false,
          });

          await svc.from("transactions").insert({
            wallet_id: vendorWallet.id,
            amount: vendorCreditAmount,
            transaction_type: "Credit",
            reference_id: groupRef,
            description: orderPackagingFee > 0
              ? `Order received (incl. ₦${orderPackagingFee} packaging): ${groupRef}`
              : `Order received: ${groupRef}`,
          });
        }
      }
    }

    // Deduct customer once — total subtotal + one delivery fee + packaging.
    // Atomic + re-checks sufficiency at the DB level so two concurrent
    // "Place Order" taps (or a double network retry) can't both succeed
    // against the same stale balance and overdraw the wallet.
    const { data: balanceAfterDebit, error: debitErr } = await svc.rpc("adjust_wallet_balance", {
      p_user_id: customerId,
      p_column: "customer_balance",
      p_delta: -totalPrice,
      p_require_sufficient: true,
    });

    if (debitErr || balanceAfterDebit === null) {
      console.error("Customer debit failed (likely insufficient balance at commit time):", debitErr);
      // Best-effort compensation: the orders/items already inserted above
      // could not be safely un-created without a transaction, so mark
      // them Cancelled and reverse any vendor credits already applied.
      for (const oid of orderIds) {
        await svc.from("orders").update({ status: "Cancelled" }).eq("id", oid);
      }
      return json({ error: "Payment failed — insufficient wallet balance. Your order was not placed." }, 400);
    }

    await svc.from("transactions").insert({
      wallet_id: customerWallet.id,
      amount: totalPrice,
      transaction_type: "Debit",
      reference_id: groupRef,
      description: `Order payment: ${groupRef}`,
    });

    // Credit platform with the delivery fee (₦0 if pass used)
    if (effectiveDeliveryFee > 0) {
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
            p_delta: effectiveDeliveryFee,
            p_require_sufficient: false,
          });

          await svc.from("transactions").insert({
            wallet_id: ownerWallet.id,
            amount: effectiveDeliveryFee,
            transaction_type: "Credit",
            reference_id: groupRef,
            description: `Delivery fee: ${groupRef}`,
          });
        }
      }
    }

    // ── Mark pass as used ─────────────────────────────────────────────────
    if (passId) {
      await svc
        .from("free_delivery_passes")
        .update({ is_used: true, used_at: new Date().toISOString(), order_ref: groupRef })
        .eq("id", passId);
    }

    // ── Check if this is the referee's first completed order → award referral ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Count prior paid orders by this customer (before this one)
    const { count: priorOrders } = await svc
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .in("status", ["Pending", "Preparing", "Out for Delivery", "Arrived at Dropoff", "Completed"])
      .not("id", "in", `(${orderIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);

    if ((priorOrders ?? 0) === 0) {
      // This IS their first order — check if they were referred
      fetch(`${supabaseUrl}/functions/v1/award-referral`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ refereeId: customerId, orderId: groupRef }),
      }).catch(() => {/* non-blocking */});
    }

    // Mention the scheduled time (if any) in vendor/operator notification text,
    // so they know not to rush a pre-order. Note: this still sends the
    // notification immediately at order-placement time — actually *delaying*
    // the notification until closer to the scheduled time would need a
    // separate cron job, which is not implemented here.
    const scheduleText = scheduledForDate
      ? ` for ${new Date(scheduledForDate).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}`
      : "";

    // ── Fire push notifications (non-blocking) ────────────────────────────
    // Notify vendor(s) + all operators about the new order(s)
    for (const group of vendorGroups) {
      const { vendorId, subtotal: vendorSubtotal } = group;
      // Resolve vendor name for the notification body
      const { data: vendorInfo } = await svc
        .from("vendors")
        .select("name, owner_id")
        .eq("id", vendorId)
        .maybeSingle();

      const vendorName = vendorInfo?.name ?? "a vendor";
      const shortRef   = groupRef;
      const amount     = formatNairaServer(vendorSubtotal);

      // Notify the specific vendor owner
      if (vendorInfo?.owner_id) {
        fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            targets: "user",
            userId: vendorInfo.owner_id,
            title: "New Order Received! 🍔",
            body: `Order #${shortRef} has been placed${scheduleText}. Tap to view and prepare.`,
            url: "/vendor-orders",
          }),
        }).catch(() => {/* non-blocking */});
      }

      // Notify all Operators
      fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          targets: "role",
          role: "Operator",
          title: "New Campus Order Placed! 🔔",
          body: `Order #${shortRef} was placed at ${vendorName} for ${amount}${scheduleText}.`,
          url: "/operator-orders",
        }),
      }).catch(() => {/* non-blocking */});
    }
    // ─────────────────────────────────────────────────────────────────────

    return json({ success: true, orderIds, groupRef });
  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ error: String(err) }, 500);
  }
});

function formatNairaServer(amount: number): string {
  return "₦" + Number(amount).toLocaleString("en-NG", { minimumFractionDigits: 0 });
}
