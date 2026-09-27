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

    // ✅ FIXED: Explicitly allow subtotal to be 0 (e.g., ₦0 items or soups)
    if (
      !customerId ||
      !Array.isArray(vendorGroups) ||
      vendorGroups.length === 0 ||
      !dropoffLocationId ||
      subtotal === undefined ||
      subtotal === null ||
      typeof subtotal !== "number" ||
      subtotal < 0
    ) {
      return json({ error: "Missing required fields" }, 400);
    }

    // Validate the scheduled time server-side
    let scheduledForDate: string | null = null;
    if (scheduledFor) {
      const d = new Date(scheduledFor);
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        return json({ error: "Scheduled delivery time must be a valid time in the future" }, 400);
      }
      const MIN_LEAD_MS = 60 * 60 * 1000;
      if (d.getTime() < Date.now() + MIN_LEAD_MS) {
        return json({ error: "Scheduled delivery time must be at least 1 hour from now" }, 400);
      }
      const lagosHour = Number(
        new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }).format(d)
      );
      if (lagosHour < 11 || lagosHour >= 20) {
        return json({ error: "Scheduled delivery is only available between 11:00 AM and 8:00 PM" }, 400);
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

    // ── Read service fees from app_settings ─────────────────────────────
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

    // ── Resolve free delivery pass ───────────────────────────────────────
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
        .order("expires_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!pass) {
        return json({ error: "No valid Free Delivery Pass available" }, 400);
      }
      passId = pass.id;
    }

    // Total packaging fee calculation across plates
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

    // Check customer balance
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
          price: Number(item.price ?? 0),
          quantity: item.quantity,
          plate_label: plate.label,
        }))
      );
      if (orderItemRows.length === 0) continue;

      const packedPlates = nonEmptyPlates.filter((plate) => plate.packagingRequested);
      const orderPackagingFee = packedPlates.length * PACKAGING_FEE_UNIT;
      const platePackaging: Record<string, boolean> = {};
      nonEmptyPlates.forEach((plate) => { platePackaging[plate.label] = !!plate.packagingRequested; });

      const isFirst = orderIds.length === 0;
      const orderDeliveryFee = isFirst ? effectiveDeliveryFee : 0;
      const orderTotal = Number(vendorSubtotal ?? 0) + orderDeliveryFee + orderPackagingFee;

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
          subtotal: Number(vendorSubtotal ?? 0),
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

      // Insert order items
      await svc.from("order_items").insert(
        orderItemRows.map((row) => ({ ...row, order_id: orderData.id }))
      );

      // Credit vendor wallet
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
          const vendorCreditAmount = Number(vendorSubtotal ?? 0) + orderPackagingFee;
          if (vendorCreditAmount > 0) {
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
    }

    // Deduct customer wallet
    const { data: balanceAfterDebit, error: debitErr } = await svc.rpc("adjust_wallet_balance", {
      p_user_id: customerId,
      p_column: "customer_balance",
      p_delta: -totalPrice,
      p_require_sufficient: true,
    });

    if (debitErr || balanceAfterDebit === null) {
      console.error("Customer debit failed:", debitErr);
      for (const oid of orderIds) {
        await svc.from("orders").update({ status: "Cancelled" }).eq("id", oid);
      }
      return json({ error: "Payment failed — insufficient wallet balance. Your order was not placed." }, 400);
    }

    if (totalPrice > 0) {
      await svc.from("transactions").insert({
        wallet_id: customerWallet.id,
        amount: totalPrice,
        transaction_type: "Debit",
        reference_id: groupRef,
        description: `Order payment: ${groupRef}`,
      });
    }

    // Credit platform with delivery fee
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

    // Mark pass as used
    if (passId) {
      await svc
        .from("free_delivery_passes")
        .update({ is_used: true, used_at: new Date().toISOString(), order_ref: groupRef })
        .eq("id", passId);
    }

    // Check referral
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { count: priorOrders } = await svc
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .in("status", ["Pending", "Preparing", "Out for Delivery", "Arrived at Dropoff", "Completed"])
      .not("id", "in", `(${orderIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);

    if ((priorOrders ?? 0) === 0) {
      fetch(`${supabaseUrl}/functions/v1/award-referral`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ refereeId: customerId, orderId: groupRef }),
      }).catch(() => {});
    }

    const scheduleText = scheduledForDate
      ? ` for ${new Date(scheduledForDate).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}`
      : "";

    // Send push notifications
    for (const group of vendorGroups) {
      const { vendorId, subtotal: vendorSubtotal } = group;
      const { data: vendorInfo } = await svc
        .from("vendors")
        .select("name, owner_id")
        .eq("id", vendorId)
        .maybeSingle();

      const vendorName = vendorInfo?.name ?? "a vendor";
      const shortRef   = groupRef;
      const amount     = formatNairaServer(vendorSubtotal ?? 0);

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
        }).catch(() => {});
      }

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
      }).catch(() => {});
    }

    return json({ success: true, orderIds, groupRef });
  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ error: String(err) }, 500);
  }
});

function formatNairaServer(amount: number): string {
  return "₦" + Number(amount ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 0 });
}