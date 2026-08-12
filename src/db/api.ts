import { supabase } from '@/client/supabase';
import type {
  Profile,
  Vendor,
  MenuItem,
  MenuSection,
  CampusDropoffLocation,
  Wallet,
  Transaction,
  Order,
  OrderItem,
  SupportRequest,
  BankDetails,
  WithdrawalRequest,
  FreeDeliveryPass,
  ReferralStats,
  AdminKPIs,
  AdminOrderRow,
  AdminCustomerRow,
  AdminTransactionRow,
  PeakHourData,
  TopDishData,
  HotspotData,
  Announcement,
} from '@/types/types';

// =====================
// Auth / Profiles
// =====================
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<void> {
  await supabase.from('profiles').update(updates).eq('id', userId);
}

// =====================
// Vendors
// =====================
export async function getVendors(): Promise<Vendor[]> {
  const { data } = await supabase
    .from('vendors')
    .select('*')
    .order('created_at', { ascending: false });
  return Array.isArray(data) ? data : [];
}

export async function getVendorById(id: string): Promise<Vendor | null> {
  const { data } = await supabase.from('vendors').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function getVendorByOwnerId(ownerId: string): Promise<Vendor | null> {
  const { data } = await supabase
    .from('vendors')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();
  return data;
}

export async function updateVendorStatus(id: string, status: 'Open' | 'Closed'): Promise<void> {
  await supabase.from('vendors').update({ status }).eq('id', id);
}

export async function updateVendor(id: string, updates: { name?: string; image?: string }): Promise<void> {
  await supabase.from('vendors').update(updates).eq('id', id);
}

export async function createVendor(ownerId: string, name: string): Promise<Vendor | null> {
  const { data } = await supabase
    .from('vendors')
    .insert({ owner_id: ownerId, name: name.trim(), status: 'Open', image: '' })
    .select('*')
    .maybeSingle();
  return data;
}

// =====================
// Menu Sections (Categories Table)
// =====================
export async function getSectionsByVendor(vendorId: string): Promise<MenuSection[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('sort_order', { ascending: true });
  return Array.isArray(data) ? data : [];
}

export async function addMenuSection(vendorId: string, name: string, sortOrder: number): Promise<MenuSection | null> {
  const { data } = await supabase
    .from('categories')
    .insert({ vendor_id: vendorId, name: name.trim(), sort_order: sortOrder })
    .select('*')
    .maybeSingle();
  return data;
}

export async function deleteMenuSection(id: string): Promise<void> {
  await supabase.from('categories').delete().eq('id', id);
}

// =====================
// Menus (Products Table)
// =====================
export async function getMenuByVendor(vendorId: string): Promise<MenuItem[]> {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: true });
  return Array.isArray(data) ? data : [];
}

export async function getActiveMenuByVendor(vendorId: string): Promise<MenuItem[]> {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  return Array.isArray(data) ? data : [];
}

export async function toggleMenuItemActive(id: string, isActive: boolean): Promise<void> {
  await supabase.from('products').update({ is_active: isActive }).eq('id', id);
}

export async function addMenuItem(item: Omit<MenuItem, 'id' | 'created_at'>): Promise<void> {
  await supabase.from('products').insert(item);
}

export async function updateMenuItem(id: string, updates: Partial<Omit<MenuItem, 'id' | 'created_at'>>): Promise<void> {
  await supabase.from('products').update(updates).eq('id', id);
}

export async function deleteMenuItem(id: string): Promise<void> {
  await supabase.from('products').delete().eq('id', id);
}

// =====================
// Campus Dropoff Locations
// =====================
export async function getDropoffLocations(): Promise<CampusDropoffLocation[]> {
  const { data } = await supabase
    .from('campus_dropoff_locations')
    .select('*')
    .order('location_name', { ascending: true });
  return Array.isArray(data) ? data : [];
}

// =====================
// Wallet
// =====================
export async function getWallet(userId: string): Promise<Wallet | null> {
  const { data } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const wallet = await getWallet(userId);
  if (!wallet) return [];
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
    .limit(50);
  return Array.isArray(data) ? data : [];
}

// =====================
// Bank Details
// =====================

export async function getBankDetails(userId: string): Promise<BankDetails | null> {
  const { data } = await supabase
    .from('bank_details')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function saveBankDetails(
  userId: string,
  details: { bankName: string; accountNumber: string; accountName: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('bank_details')
    .upsert({
      user_id: userId,
      bank_name: details.bankName,
      account_number: details.accountNumber,
      account_name: details.accountName,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  return { error: error?.message ?? null };
}

export async function requestWithdrawal(
  amount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('request-withdrawal', {
      body: { amount },
    });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        try {
          const body = await ctx.json();
          if (body?.error) return { success: false, error: body.error };
        } catch {
          // context body not JSON — fall through
        }
      }
      return { success: false, error: error.message };
    }
    if (data?.error) return { success: false, error: data.error };
    return { success: true };
  } catch (e) {
    console.error('requestWithdrawal exception:', e);
    return { success: false, error: 'Network error — please try again' };
  }
}

export async function getWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]> {
  const { data } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('vendor_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return Array.isArray(data) ? data : [];
}

// =====================
// Orders
// =====================
export async function placeOrder(params: {
  customerId: string;
  vendorGroups: Array<{
    vendorId: string;
    subtotal: number;
    items: Array<{ menuId: string; itemName: string; price: number; quantity: number }>;
    packagingRequested?: boolean;
  }>;
  dropoffLocationId: string;
  locationDescription: string;
  deliveryNotes: string;
  subtotal: number;
  useDeliveryPass?: boolean;
}): Promise<{ orderId: string | null; error?: string }> {
  const { data, error } = await supabase.functions.invoke('place-order', { body: params });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let msg = error.message;
    if (ctx) { try { const b = await ctx.json(); msg = b?.error ?? msg; } catch { /* ignore */ } }
    console.error('place-order error:', msg);
    return { orderId: null, error: msg };
  }
  if (!data?.orderIds?.length) return { orderId: null };
  return { orderId: data.orderIds[0] };
}

// =====================
// Free Delivery Pass Purchase
// =====================
export async function buyDeliveryPass(customerId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('buy-delivery-pass', {
    body: { customerId },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let msg = error.message;
    if (ctx) { try { const b = await ctx.json(); msg = b?.error ?? msg; } catch { /* ignore */ } }
    return { success: false, error: msg };
  }
  return { success: !!data?.success, error: data?.error };
}

// =====================
// Referral System
// =====================
export async function getReferralStats(userId: string): Promise<ReferralStats | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.referral_code) return null;

  const { count: totalReferred } = await supabase
    .from('referral_rewards')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', userId);

  const now = new Date().toISOString();
  const { count: activePasses } = await supabase
    .from('free_delivery_passes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_used', false)
    .gt('expires_at', now);

  return {
    referral_code: profile.referral_code,
    total_referred: totalReferred ?? 0,
    active_passes: activePasses ?? 0,
  };
}

export async function getActiveFreeDeliveryPasses(userId: string): Promise<FreeDeliveryPass[]> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('free_delivery_passes')
    .select('*')
    .eq('user_id', userId)
    .eq('is_used', false)
    .gt('expires_at', now)
    .order('expires_at', { ascending: true })
    .limit(50);
  return Array.isArray(data) ? data : [];
}

export async function saveReferredBy(userId: string, referralCode: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ referred_by: referralCode.trim().toUpperCase() })
    .eq('id', userId)
    .is('referred_by', null);
  return !error;
}

export async function getCustomerOrders(customerId: string): Promise<Order[]> {
  const { data } = await supabase
    .from('orders')
    .select(`
      *,
      vendor:vendor_id(id, name),
      dropoff_location:dropoff_location_id(id, location_name),
      order_items(*)
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(100);
  return Array.isArray(data) ? data : [];
}

export async function getVendorOrders(vendorId: string): Promise<Order[]> {
  const { data } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customer_id(id, name, email),
      dropoff_location:dropoff_location_id(id, location_name),
      order_items(*)
    `)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(100);
  return Array.isArray(data) ? data : [];
}

export async function getOperatorOrders(): Promise<Order[]> {
  const { data } = await supabase
    .from('orders')
    .select(`
      *,
      vendor:vendor_id(id, name),
      customer:customer_id(id, name),
      dropoff_location:dropoff_location_id(id, location_name),
      order_items(*)
    `)
    .order('created_at', { ascending: false })
    .limit(200);
  return Array.isArray(data) ? data : [];
}

export async function updateOrderStatus(
  orderId: string,
  status: Order['status'],
  runnerId?: string
): Promise<{ error: string | null }> {
  const updates: Partial<Order> = runnerId ? { status, runner_id: runnerId } : { status };
  const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
  return { error: error?.message ?? null };
}

export async function getOrderStatusHistory(
  orderId: string
): Promise<Array<{ id: string; status: string; created_at: string }>> {
  const { data } = await supabase
    .from('order_status_history')
    .select('id, status, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  return Array.isArray(data) ? data : [];
}

export async function cancelOrder(orderId: string): Promise<{ error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke('cancel-order', {
    body: { order_id: orderId },
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { error: null };
}

// =====================
// App Settings
// =====================
export async function getAppSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function getAppIsOpen(): Promise<boolean> {
  const val = await getAppSetting('is_open');
  return val !== 'false';
}

export async function setAppIsOpen(isOpen: boolean): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  await supabase.functions.invoke('set-app-status', {
    body: { is_open: isOpen },
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
  });
}

export async function getDeliveryFee(): Promise<number> {
  const val = await getAppSetting('delivery_fee');
  return val ? Number(val) : 199;
}

export async function getPackagingFee(): Promise<number> {
  const val = await getAppSetting('packaging_fee');
  return val ? Number(val) : 200;
}

export async function saveDeliveryFee(fee: number): Promise<void> {
  await setAppSetting('delivery_fee', String(fee));
}

export async function savePackagingFee(fee: number): Promise<void> {
  await setAppSetting('packaging_fee', String(fee));
}

// =====================
// Support Requests
// =====================
export async function submitSupportRequest(
  subject: string,
  message: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase.from('support_requests').insert({
    subject,
    message,
    submitted_by: userId,
  });
  return !error;
}

export async function getUserSupportRequests(userId: string): Promise<SupportRequest[]> {
  const { data } = await supabase
    .from('support_requests')
    .select('*')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return Array.isArray(data) ? data : [];
}

// ============================================================================
// SUPER ADMIN API
// ============================================================================

export async function getAdminKPIs(): Promise<AdminKPIs> {
  const activeStatuses = ['Pending', 'Preparing', 'Out for Delivery', 'Arrived at Dropoff'];

  const [ordersRes, volumeRes, customersRes, vendorsRes, ridersRes] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', activeStatuses),
    supabase.from('orders').select('total_price').not('status', 'eq', 'Cancelled'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'Customer'),
    supabase.from('vendors').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'Operator'),
  ]);

  const grossVolume = Array.isArray(volumeRes.data)
    ? volumeRes.data.reduce((sum, o) => sum + Number(o.total_price), 0)
    : 0;

  return {
    activeOrders: ordersRes.count ?? 0,
    grossVolume,
    activeCustomers: customersRes.count ?? 0,
    registeredVendors: vendorsRes.count ?? 0,
    activeRiders: ridersRes.count ?? 0,
  };
}

export async function getAdminLiveOrders(limit = 30): Promise<AdminOrderRow[]> {
  const { data } = await supabase
    .from('orders')
    .select('id, order_ref, status, total_price, created_at, runner_id, customer:customer_id(name), vendor:vendor_id(name), runner:runner_id(name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!Array.isArray(data)) return [];
  return data.map((o) => ({
    id: o.id,
    order_ref: o.order_ref,
    customer_name: (o.customer as { name?: string } | null)?.name ?? '—',
    vendor_name: (o.vendor as { name?: string } | null)?.name ?? '—',
    status: o.status,
    total_price: Number(o.total_price),
    created_at: o.created_at,
    runner_id: o.runner_id,
    runner_name: (o.runner as { name?: string } | null)?.name ?? null,
  }));
}

export async function getAdminOrders(opts: {
  vendorId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminOrderRow[]> {
  let q = supabase
    .from('orders')
    .select('id, order_ref, status, total_price, created_at, runner_id, customer:customer_id(name), vendor:vendor_id(name), runner:runner_id(name)')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.vendorId) q = q.eq('vendor_id', opts.vendorId);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.dateFrom) q = q.gte('created_at', opts.dateFrom);
  if (opts.dateTo) q = q.lte('created_at', opts.dateTo);
  if (opts.offset) q = q.range(opts.offset, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);

  const { data } = await q;
  if (!Array.isArray(data)) return [];
  return data.map((o) => ({
    id: o.id,
    order_ref: o.order_ref,
    customer_name: (o.customer as { name?: string } | null)?.name ?? '—',
    vendor_name: (o.vendor as { name?: string } | null)?.name ?? '—',
    status: o.status,
    total_price: Number(o.total_price),
    created_at: o.created_at,
    runner_id: o.runner_id,
    runner_name: (o.runner as { name?: string } | null)?.name ?? null,
  }));
}

export async function getAdminVendors(): Promise<Vendor[]> {
  const { data } = await supabase
    .from('vendors')
    .select('*')
    .order('created_at', { ascending: false });
  return Array.isArray(data) ? data : [];
}

export async function adminUpdateVendor(
  id: string,
  updates: Partial<Pick<Vendor, 'name' | 'status' | 'orders_paused'>>
): Promise<void> {
  await supabase.from('vendors').update(updates).eq('id', id);
}

export async function adminDeleteVendor(id: string): Promise<void> {
  await supabase.from('vendors').delete().eq('id', id);
}

// ── Menu editing (admin - products table) ──────────────────────────────────────
export async function adminUpsertMenuItem(
  item: Partial<MenuItem> & { vendor_id: string; item_name: string; price: number }
): Promise<void> {
  if (item.id) {
    await supabase.from('products').update(item).eq('id', item.id);
  } else {
    await supabase.from('products').insert(item);
  }
}

export async function adminDeleteMenuItem(id: string): Promise<void> {
  await supabase.from('products').delete().eq('id', id);
}

export async function getAdminCustomers(limit = 50, offset = 0): Promise<AdminCustomerRow[]> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email, phone_number, created_at')
    .eq('role', 'Customer')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (!Array.isArray(profiles)) return [];

  const ids = profiles.map((p) => p.id);
  const [walletsRes, passesRes, ordersRes] = await Promise.all([
    supabase.from('wallets').select('user_id, customer_balance').in('user_id', ids),
    supabase.from('free_delivery_passes')
      .select('user_id')
      .in('user_id', ids)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString()),
    supabase.from('orders').select('id, customer_id').in('customer_id', ids),
  ]);

  const walletMap: Record<string, number> = {};
  (walletsRes.data ?? []).forEach((w) => { walletMap[w.user_id] = Number(w.customer_balance); });

  const passMap: Record<string, number> = {};
  (passesRes.data ?? []).forEach((p) => { passMap[p.user_id] = (passMap[p.user_id] ?? 0) + 1; });

  const orderMap: Record<string, number> = {};
  (ordersRes.data ?? []).forEach((o) => { orderMap[o.customer_id] = (orderMap[o.customer_id] ?? 0) + 1; });

  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone_number: p.phone_number ?? '',
    customer_balance: walletMap[p.id] ?? 0,
    active_passes: passMap[p.id] ?? 0,
    total_orders: orderMap[p.id] ?? 0,
    created_at: p.created_at,
  }));
}

export async function getAdminTransactions(opts: {
  dateFrom?: string;
  dateTo?: string;
  txType?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminTransactionRow[]> {
  let q = supabase
    .from('transactions')
    .select('id, amount, transaction_type, reference_id, description, created_at, wallet_id')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.txType) q = q.eq('transaction_type', opts.txType);
  if (opts.dateFrom) q = q.gte('created_at', opts.dateFrom);
  if (opts.dateTo) q = q.lte('created_at', opts.dateTo);
  if (opts.offset) q = q.range(opts.offset, (opts.offset ?? 0) + (opts.limit ?? 100) - 1);

  const { data } = await q;
  if (!Array.isArray(data)) return [];
  return data.map((t) => ({
    id: t.id,
    amount: Number(t.amount),
    transaction_type: t.transaction_type,
    reference_id: t.reference_id ?? '',
    description: t.description ?? '',
    created_at: t.created_at,
    wallet_user_name: '',
  }));
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  await supabase.from('app_settings').update({ value }).eq('key', key);
}

export async function getOperators(): Promise<Pick<Profile, 'id' | 'name'>[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'Operator')
    .order('name', { ascending: true })
    .limit(100);
  return Array.isArray(data) ? data : [];
}

export async function getAdminPeakHours(): Promise<PeakHourData[]> {
  const { data } = await supabase
    .from('orders')
    .select('created_at')
    .not('status', 'eq', 'Cancelled')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (!Array.isArray(data)) return [];
  const hourMap: Record<number, number> = {};
  data.forEach((o) => {
    const h = new Date(o.created_at).getHours();
    hourMap[h] = (hourMap[h] ?? 0) + 1;
  });
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourMap[h] ?? 0 }));
}

export async function getAdminTopDishes(limit = 5): Promise<TopDishData[]> {
  const { data } = await supabase
    .from('order_items')
    .select('item_name, price, quantity, order:order_id(vendor:vendor_id(name))')
    .limit(2000);
  if (!Array.isArray(data)) return [];
  const dishMap: Record<string, { total_orders: number; total_revenue: number; vendor_name: string }> = {};
  data.forEach((item) => {
    const vendorName = (item.order as { vendor?: { name?: string } } | null)?.vendor?.name ?? '—';
    const key = `${item.item_name}__${vendorName}`;
    if (!dishMap[key]) dishMap[key] = { total_orders: 0, total_revenue: 0, vendor_name: vendorName };
    dishMap[key].total_orders += item.quantity ?? 1;
    dishMap[key].total_revenue += Number(item.price) * (item.quantity ?? 1);
  });
  return Object.entries(dishMap)
    .map(([key, v]) => ({ item_name: key.split('__')[0], vendor_name: v.vendor_name, total_orders: v.total_orders, total_revenue: v.total_revenue }))
    .sort((a, b) => b.total_orders - a.total_orders)
    .slice(0, limit);
}

export async function getAdminHotspots(): Promise<HotspotData[]> {
  const { data } = await supabase
    .from('orders')
    .select('dropoff_location:dropoff_location_id(location_name)')
    .not('dropoff_location_id', 'is', null)
    .not('status', 'eq', 'Cancelled')
    .limit(2000);
  if (!Array.isArray(data)) return [];
  const spotMap: Record<string, number> = {};
  data.forEach((o) => {
    const name = (o.dropoff_location as { location_name?: string } | null)?.location_name ?? 'Unknown';
    spotMap[name] = (spotMap[name] ?? 0) + 1;
  });
  return Object.entries(spotMap)
    .map(([location_name, order_count]) => ({ location_name, order_count }))
    .sort((a, b) => b.order_count - a.order_count);
}

export async function getAdminAvgFulfillmentMinutes(): Promise<number> {
  const { data } = await supabase
    .from('orders')
    .select('created_at, completed_at')
    .eq('status', 'Completed')
    .not('completed_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!Array.isArray(data) || data.length === 0) return 0;

  const durationsMs = data
    .map((o) => new Date(o.completed_at as string).getTime() - new Date(o.created_at).getTime())
    .filter((ms) => Number.isFinite(ms) && ms > 0);

  if (durationsMs.length === 0) return 0;

  const avgMs = durationsMs.reduce((sum, ms) => sum + ms, 0) / durationsMs.length;
  return Math.round(avgMs / 60000);
}

export async function getAnnouncements(limit = 20): Promise<Announcement[]> {
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return Array.isArray(data) ? data : [];
}
