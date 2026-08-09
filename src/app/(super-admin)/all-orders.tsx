/**
 * Admin — Order Management
 * Filter by status / vendor / date. Force complete, cancel, refund, reassign rider.
 */
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Package, CheckCircle, XCircle, RotateCcw, User } from 'lucide-react-native';

import { getAdminOrders, getAdminVendors, getOperators } from '@/db/api';
import { supabase } from '@/client/supabase';
import type { AdminOrderRow, Vendor } from '@/types/types';
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

const STATUSES = ['', 'Pending', 'Preparing', 'Out for Delivery', 'Arrived at Dropoff', 'Completed', 'Cancelled'];

export default function AdminOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [actionOrder, setActionOrder] = useState<AdminOrderRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reassignMode, setReassignMode] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const [o, v, ops] = await Promise.all([
      getAdminOrders({ status: statusFilter || undefined, vendorId: vendorFilter || undefined }),
      getAdminVendors(),
      getOperators(),
    ]);
    setOrders(o);
    setVendors(v);
    setOperators(ops);
    setLoading(false);
  }, [statusFilter, vendorFilter]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const callOverride = async (action: string, extra?: Record<string, unknown>) => {
    if (!actionOrder) return;
    setActionLoading(true);
    const { error } = await supabase.functions.invoke('admin-override', {
      body: { action, orderId: actionOrder.id, ...extra },
    });
    setActionLoading(false);
    setActionOrder(null);
    setReassignMode(false);
    if (error) {
      setMsg({ text: 'Action failed. Please try again.', ok: false });
    } else {
      setMsg({ text: `${action.replace('_', ' ')} succeeded.`, ok: true });
      await load();
    }
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}><ArrowLeft size={22} color="#94a3b8" /></Pressable>
        <Package size={20} color={ORANGE} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 }}>Order Management</Text>
        <Text style={{ color: '#64748b', fontSize: 12 }}>{orders.length} orders</Text>
      </View>

      {/* Feedback banner */}
      {msg && (
        <View style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: msg.ok ? '#14532d' : '#450a0a', borderRadius: 10, padding: 10 }}>
          <Text style={{ color: msg.ok ? '#86efac' : '#fca5a5', fontSize: 13, textAlign: 'center' }}>{msg.text}</Text>
        </View>
      )}

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}>
        {STATUSES.map((s) => (
          <Pressable
            key={s || 'all'}
            onPress={() => setStatusFilter(s)}
            style={{ backgroundColor: statusFilter === s ? ORANGE : CARD, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: statusFilter === s ? ORANGE : BORDER }}
          >
            <Text style={{ color: statusFilter === s ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: '700' }}>{s || 'All'}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading
        ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={ORANGE} /></View>
        : (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
          >
            {orders.length === 0 && <Text style={{ color: '#475569', textAlign: 'center', marginTop: 40 }}>No orders found</Text>}
            {orders.map((o) => (
              <View key={o.id} style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: CARD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 12 }}>#{o.order_ref.slice(-6)}</Text>
                  <View style={{ backgroundColor: (STATUS_COLOR[o.status] ?? '#94a3b8') + '22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 }}>
                    <Text style={{ color: STATUS_COLOR[o.status] ?? '#94a3b8', fontSize: 10, fontWeight: '700' }}>{o.status}</Text>
                  </View>
                  <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 13, marginLeft: 'auto' }}>{formatNaira(o.total_price)}</Text>
                </View>
                <Text style={{ color: '#cbd5e1', fontSize: 12 }}>👤 {o.customer_name} · 🏪 {o.vendor_name}</Text>
                {o.runner_name && <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>🛵 {o.runner_name}</Text>}
                <Text style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>{new Date(o.created_at).toLocaleString()}</Text>

                <Pressable
                  onPress={() => setActionOrder(o)}
                  style={{ marginTop: 10, backgroundColor: '#334155', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700' }}>Admin Actions</Text>
                </Pressable>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

      {/* Action Sheet */}
      <Modal visible={!!actionOrder} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 4 }}>
              Order #{actionOrder?.order_ref.slice(-6)}
            </Text>
            <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 20 }}>
              {actionOrder?.customer_name} · {formatNaira(actionOrder?.total_price ?? 0)}
            </Text>

            {!reassignMode ? (
              <>
                {[
                  { label: 'Force Complete', action: 'force_complete', icon: CheckCircle, color: '#22c55e' },
                  { label: 'Force Cancel',   action: 'force_cancel',   icon: XCircle,    color: '#ef4444' },
                  { label: 'Issue Refund',   action: 'refund',         icon: RotateCcw,  color: '#60a5fa' },
                ].map(({ label, action, icon: Icon, color }) => (
                  <Pressable
                    key={action}
                    onPress={() => callOverride(action)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color + '18', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: color + '44' }}
                  >
                    {actionLoading ? <ActivityIndicator color={color} size="small" /> : <Icon size={18} color={color} />}
                    <Text style={{ color, fontWeight: '700', fontSize: 14 }}>{label}</Text>
                  </Pressable>
                ))}

                <Pressable
                  onPress={() => setReassignMode(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#33415544', borderRadius: 12, padding: 14, marginBottom: 10 }}
                >
                  <User size={18} color="#a78bfa" />
                  <Text style={{ color: '#a78bfa', fontWeight: '700', fontSize: 14 }}>Reassign Rider</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>Select a rider to assign:</Text>
                <ScrollView style={{ maxHeight: 200 }}>
                  {operators.map((op) => (
                    <Pressable
                      key={op.id}
                      onPress={() => callOverride('reassign_rider', { runnerId: op.id })}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, backgroundColor: '#334155', marginBottom: 8 }}
                    >
                      <User size={16} color="#a78bfa" />
                      <Text style={{ color: '#e2e8f0', fontSize: 13 }}>{op.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            <Pressable
              onPress={() => { setActionOrder(null); setReassignMode(false); }}
              style={{ marginTop: 6, backgroundColor: '#334155', borderRadius: 12, padding: 13, alignItems: 'center' }}
            >
              <Text style={{ color: '#64748b', fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
