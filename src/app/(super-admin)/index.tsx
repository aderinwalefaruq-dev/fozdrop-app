/**
 * Super Admin Dashboard — Main Control Centre
 * • Emergency kill switches (Global Order Freeze + per-vendor pause)
 * • Live KPI counters
 * • Live order feed (auto-refreshing every 15 s)
 * • Navigation tiles to all sub-portals
 */
import {
  View, Text, ScrollView, Pressable, Switch,
  ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ShieldAlert, Users, Package, DollarSign, Store,
  Bike, RefreshCw, ChevronRight, Megaphone,
  BarChart2, Layers, Zap, Settings2,
} from 'lucide-react-native';

import {
  getAdminKPIs, getAdminLiveOrders, getAdminVendors,
  adminUpdateVendor, getAppSetting, setAppSetting,
  getDeliveryFee, getPackagingFee, saveDeliveryFee, savePackagingFee,
} from '@/db/api';
import type { AdminKPIs, AdminOrderRow, Vendor } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';

const ORANGE = '#F25C19';
const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';

const STATUS_COLOR: Record<string, string> = {
  'Pending':            '#fbbf24',
  'Preparing':          '#60a5fa',
  'Out for Delivery':   '#a78bfa',
  'Arrived at Dropoff': '#34d399',
  'Completed':          '#22c55e',
  'Cancelled':          '#f87171',
};

export default function AdminDashboard() {
  const router = useRouter();
  const [kpis, setKpis] = useState<AdminKPIs | null>(null);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [globalFreeze, setGlobalFreeze] = useState(false);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Service charges state
  const [dFee, setDFee] = useState('');
  const [pFee, setPFee] = useState('');
  const [feesSaving, setFeesSaving] = useState(false);
  const [feesMsg, setFeesMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [k, o, v, freeze, deliveryFee, packagingFee] = await Promise.all([
      getAdminKPIs(),
      getAdminLiveOrders(20),
      getAdminVendors(),
      getAppSetting('is_open'),
      getDeliveryFee(),
      getPackagingFee(),
    ]);
    setKpis(k);
    setOrders(o);
    setVendors(v);
    setGlobalFreeze(freeze === 'false');
    setDFee(String(deliveryFee));
    setPFee(String(packagingFee));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    intervalRef.current = setInterval(load, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleGlobalFreeze = async (val: boolean) => {
    setFreezeLoading(true);
    await setAppSetting('is_open', val ? 'false' : 'true');
    setGlobalFreeze(val);
    setFreezeLoading(false);
  };

  const handleSaveFees = async () => {
    const d = Number(dFee);
    const p = Number(pFee);
    if (isNaN(d) || d < 0 || isNaN(p) || p < 0) {
      setFeesMsg({ ok: false, text: 'Enter valid positive amounts.' });
      return;
    }
    setFeesSaving(true);
    setFeesMsg(null);
    await Promise.all([saveDeliveryFee(d), savePackagingFee(p)]);
    setFeesSaving(false);
    setFeesMsg({ ok: true, text: 'Fees updated!' });
    setTimeout(() => setFeesMsg(null), 3000);
  };

  const toggleVendorPause = async (vendor: Vendor) => {
    const newPaused = !vendor.orders_paused;
    await adminUpdateVendor(vendor.id, { orders_paused: newPaused });
    setVendors((prev) => prev.map((v) => v.id === vendor.id ? { ...v, orders_paused: newPaused } : v));
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    );
  }

  const navTiles = [
    { label: 'Vendors',     icon: Store,     route: '/(super-admin)/vendors'    },
    { label: 'Orders',      icon: Package,   route: '/(super-admin)/all-orders'     },
    { label: 'Users',       icon: Users,     route: '/(super-admin)/users'      },
    { label: 'Financials',  icon: DollarSign,route: '/(super-admin)/financials' },
    { label: 'Broadcast',   icon: Megaphone, route: '/(super-admin)/broadcast'  },
    { label: 'Analytics',   icon: BarChart2, route: '/(super-admin)/analytics'  },
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={28} color={ORANGE} />
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
              Admin Spot
            </Text>
          </View>
          <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
            Fozdrop Super Admin Portal • Live
          </Text>
        </View>

        {/* ── EMERGENCY CONTROLS ── */}
        <View style={{ marginHorizontal: 16, marginBottom: 20, backgroundColor: '#1a0a02', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: globalFreeze ? '#ef4444' : BORDER }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Zap size={18} color={globalFreeze ? '#ef4444' : ORANGE} />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Emergency Controls</Text>
          </View>

          {/* Global freeze */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: globalFreeze ? '#450a0a' : CARD, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: globalFreeze ? '#ef4444' : BORDER }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: globalFreeze ? '#fca5a5' : '#fff', fontWeight: '800', fontSize: 13 }}>
                🌍 Global Order Freeze
              </Text>
              <Text style={{ color: globalFreeze ? '#f87171' : '#64748b', fontSize: 11, marginTop: 3 }}>
                {globalFreeze ? '⚠️  All new orders are BLOCKED' : 'Platform accepting orders normally'}
              </Text>
            </View>
            {freezeLoading
              ? <ActivityIndicator color={ORANGE} size="small" />
              : <Switch
                  value={globalFreeze}
                  onValueChange={toggleGlobalFreeze}
                  trackColor={{ false: '#334155', true: '#ef4444' }}
                  thumbColor="#fff"
                />}
          </View>

          {/* Per-vendor pauses */}
          <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Per-Vendor Pause
          </Text>
          {vendors.slice(0, 6).map((v) => (
            <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{v.name}</Text>
                <Text style={{ color: v.orders_paused ? '#fbbf24' : '#22c55e', fontSize: 10 }}>
                  {v.orders_paused ? 'Paused' : 'Active'}
                </Text>
              </View>
              <Switch
                value={v.orders_paused}
                onValueChange={() => toggleVendorPause(v)}
                trackColor={{ false: '#334155', true: '#f59e0b' }}
                thumbColor="#fff"
              />
            </View>
          ))}
          {vendors.length > 6 && (
            <Pressable onPress={() => router.push('/(super-admin)/vendors' as RelativePathString)} style={{ marginTop: 8 }}>
              <Text style={{ color: ORANGE, fontSize: 12, textAlign: 'center' }}>+ {vendors.length - 6} more vendors →</Text>
            </Pressable>
          )}
        </View>

        {/* ── SERVICE CHARGES ── */}
        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 16, marginBottom: 10 }}>
          Service Charges
        </Text>
        <View style={{ marginHorizontal: 16, marginBottom: 20, backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Settings2 size={18} color={ORANGE} />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Adjust Fees</Text>
          </View>

          {/* Delivery Fee row */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
              DELIVERY FEE (₦)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, height: 44 }}>
              <Text style={{ color: '#64748b', fontSize: 14, marginRight: 4 }}>₦</Text>
              <TextInput
                value={dFee}
                onChangeText={setDFee}
                keyboardType="numeric"
                placeholder="e.g. 199"
                placeholderTextColor="#475569"
                style={{ flex: 1, color: '#f1f5f9', fontSize: 15, fontWeight: '700' }}
              />
            </View>
          </View>

          {/* Packaging Fee row */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
              PACKAGING FEE PER VENDOR (₦)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, height: 44 }}>
              <Text style={{ color: '#64748b', fontSize: 14, marginRight: 4 }}>₦</Text>
              <TextInput
                value={pFee}
                onChangeText={setPFee}
                keyboardType="numeric"
                placeholder="e.g. 200"
                placeholderTextColor="#475569"
                style={{ flex: 1, color: '#f1f5f9', fontSize: 15, fontWeight: '700' }}
              />
            </View>
          </View>

          {/* Feedback message */}
          {feesMsg && (
            <Text style={{ fontSize: 12, fontWeight: '700', marginBottom: 10, color: feesMsg.ok ? '#22c55e' : '#f87171' }}>
              {feesMsg.ok ? '✓ ' : '✗ '}{feesMsg.text}
            </Text>
          )}

          <Pressable
            onPress={handleSaveFees}
            disabled={feesSaving}
            style={{ backgroundColor: ORANGE, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
            className="active:opacity-75"
          >
            {feesSaving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Save Charges</Text>}
          </Pressable>
        </View>

        {/* ── KPI CARDS ── */}
        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 16, marginBottom: 10 }}>
          Live Overview
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}>
          {[
            { label: 'Active Orders',    value: String(kpis?.activeOrders ?? 0),                  icon: Package,    color: '#60a5fa' },
            { label: 'Gross Volume',     value: formatNaira(kpis?.grossVolume ?? 0),              icon: DollarSign, color: '#34d399' },
            { label: 'Customers',        value: String(kpis?.activeCustomers ?? 0),               icon: Users,      color: '#a78bfa' },
            { label: 'Vendors',          value: String(kpis?.registeredVendors ?? 0),             icon: Store,      color: ORANGE     },
            { label: 'Riders',           value: String(kpis?.activeRiders ?? 0),                  icon: Bike,       color: '#fbbf24' },
          ].map(({ label, value, icon: Icon, color }) => (
            <View key={label} style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, minWidth: 130, borderWidth: 1, borderColor: BORDER, gap: 8 }}>
              <Icon size={20} color={color} />
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{value}</Text>
              <Text style={{ color: '#64748b', fontSize: 11 }}>{label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ── NAV TILES ── */}
        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 16, marginTop: 20, marginBottom: 10 }}>
          Admin Modules
        </Text>
        <View style={{ marginHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          {navTiles.map(({ label, icon: Icon, route }) => (
            <Pressable
              key={label}
              onPress={() => router.push(route as RelativePathString)}
              style={{ flex: 1, minWidth: '45%', backgroundColor: CARD, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER, gap: 8 }}
              className="active:opacity-75"
            >
              <Icon size={22} color={ORANGE} />
              <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 13 }}>{label}</Text>
              <ChevronRight size={14} color="#475569" style={{ alignSelf: 'flex-end' }} />
            </Pressable>
          ))}
        </View>

        {/* ── LIVE ORDER FEED ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 10 }}>
          <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Live Order Feed
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
            <Text style={{ color: '#22c55e', fontSize: 10 }}>Auto-refresh 15s</Text>
          </View>
        </View>

        {orders.length === 0
          ? <Text style={{ color: '#475569', textAlign: 'center', marginBottom: 24 }}>No orders yet</Text>
          : orders.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => router.push('/(super-admin)/all-orders' as RelativePathString)}
              style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: CARD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Text style={{ color: ORANGE, fontSize: 11, fontWeight: '800' }}>#{o.order_ref.slice(-6)}</Text>
                  <View style={{ backgroundColor: STATUS_COLOR[o.status] + '22', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 }}>
                    <Text style={{ color: STATUS_COLOR[o.status] ?? '#94a3b8', fontSize: 10, fontWeight: '700' }}>{o.status}</Text>
                  </View>
                </View>
                <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 3 }}>
                  {o.customer_name} · {o.vendor_name}
                </Text>
              </View>
              <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 13 }}>{formatNaira(o.total_price)}</Text>
            </Pressable>
          ))}

        <Pressable
          onPress={() => router.push('/(super-admin)/all-orders' as RelativePathString)}
          style={{ marginHorizontal: 16, marginBottom: 40, alignItems: 'center', paddingVertical: 12 }}
        >
          <Text style={{ color: ORANGE, fontSize: 13, fontWeight: '700' }}>View All Orders →</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
