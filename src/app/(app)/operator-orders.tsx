import {
  View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '@/ctx';
import { getOperatorOrders, updateOrderStatus, cancelOrder, getProfile } from '@/db/api';
import type { Order, Profile } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const ORANGE = '#F25C19';
const CREAM = '#FAF6F0';

const STATUS_COLORS: Record<string, string> = {
  'Pending': '#fef3c7',
  'Preparing': '#dbeafe',
  'Out for Delivery': '#ede9fe',
  'Arrived at Dropoff': '#d1fae5',
  'Completed': '#f0fdf4',
  'Cancelled': '#fee2e2',
};
const STATUS_TEXT_COLORS: Record<string, string> = {
  'Pending': '#92400e',
  'Preparing': '#1d4ed8',
  'Out for Delivery': '#6d28d9',
  'Arrived at Dropoff': '#065f46',
  'Completed': '#166534',
  'Cancelled': '#991b1b',
};

// Operator can advance through the full pipeline
const OPERATOR_NEXT: Partial<Record<Order['status'], Order['status']>> = {
  'Pending': 'Preparing',
  'Preparing': 'Out for Delivery',
  'Out for Delivery': 'Arrived at Dropoff',
  'Arrived at Dropoff': 'Completed',
};
const NEXT_LABEL: Partial<Record<Order['status'], string>> = {
  'Pending': 'Mark Preparing',
  'Preparing': 'Mark Out for Delivery',
  'Out for Delivery': 'Mark Arrived',
  'Arrived at Dropoff': 'Mark Completed',
};

// Operator can cancel orders that haven't been completed or already cancelled
const OPERATOR_CANCELLABLE: Order['status'][] = ['Pending', 'Preparing', 'Out for Delivery', 'Arrived at Dropoff'];

type FilterTab = 'In Transit' | 'All';

export default function OperatorOrdersScreen() {
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('In Transit');
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  const loadData = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); setRefreshing(false); return; }
    const [p, o] = await Promise.all([
      getProfile(session.user.id),
      getOperatorOrders(),
    ]);
    setProfile(p);
    setOrders(o);
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleAdvance = async (order: Order) => {
    const next = OPERATOR_NEXT[order.status];
    if (!next || !session?.user?.id) return;
    setUpdating(order.id);
    // Stamp this operator as the order's runner. Previously runner_id was
    // never set anywhere in the normal flow, so admin screens showing
    // "runner" / "rider" per order were always blank and there was no
    // record of which operator actually handled a delivery.
    await updateOrderStatus(order.id, next, session.user.id);
    setUpdating(null);
    loadData();
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    setUpdating(id);
    setCancelTarget(null);
    await cancelOrder(id);
    setUpdating(null);
    loadData();
  };

  const inTransit = orders.filter(
    (o) => o.status === 'Out for Delivery' || o.status === 'Arrived at Dropoff'
  );
  const displayed = filter === 'In Transit' ? inTransit : orders;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{ backgroundColor: ORANGE, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>Delivery Runner</Text>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 }}>
          {profile?.name || 'Operator Dashboard'}
        </Text>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
          <StatPill label="In Transit" value={String(inTransit.length)} bg="rgba(255,255,255,0.25)" />
          <StatPill label="Preparing" value={String(orders.filter((o) => o.status === 'Pending' || o.status === 'Preparing').length)} bg="rgba(255,255,255,0.15)" />
          <StatPill label="All Active" value={String(orders.length)} bg="rgba(255,255,255,0.1)" />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
        {(['In Transit', 'All'] as FilterTab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setFilter(tab)}
            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: filter === tab ? ORANGE : '#f0f0f0' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: filter === tab ? '#fff' : '#555' }}>
              {tab} ({tab === 'In Transit' ? inTransit.length : orders.length})
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Text style={{ fontSize: 44 }}>🛵</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginTop: 14 }}>
              {filter === 'In Transit' ? 'No deliveries in transit' : 'No deliveries yet'}
            </Text>
            <Text style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
              Orders ready for delivery will appear here
            </Text>
          </View>
        }
        renderItem={({ item: order }) => (
          <OperatorOrderCard
            order={order}
            onAdvance={() => handleAdvance(order)}
            onCancel={() => setCancelTarget(order)}
            updating={updating === order.id}
          />
        )}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel order #{cancelTarget?.order_ref}? This cannot be undone and the customer will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setCancelTarget(null)}>
              Keep Order
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleCancel} className="bg-destructive">
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

function StatPill({ label, value, bg }: { label: string; value: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

function OperatorOrderCard({
  order, onAdvance, onCancel, updating,
}: {
  order: Order; onAdvance: () => void; onCancel: () => void; updating: boolean;
}) {
  const nextStatus = OPERATOR_NEXT[order.status];
  const nextLabel = NEXT_LABEL[order.status];
  const canCancel = OPERATOR_CANCELLABLE.includes(order.status);

  const statusEmoji: Record<string, string> = {
    'Pending': '🕐', 'Preparing': '👨‍🍳', 'Out for Delivery': '🛵',
    'Arrived at Dropoff': '📍', 'Completed': '✅', 'Cancelled': '❌',
  };

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }}>
      {/* Status Bar */}
      <View style={{ backgroundColor: STATUS_COLORS[order.status] || '#f5f5f5', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: STATUS_TEXT_COLORS[order.status] || '#555' }}>
          {statusEmoji[order.status] || ''} {order.status}
        </Text>
        <Text style={{ fontSize: 11, color: '#888' }}>#{order.order_ref}</Text>
      </View>

      {order.scheduled_for ? (
        <View style={{ backgroundColor: '#ede9fe', paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 12 }}>📅</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#6d28d9' }}>
            Scheduled for {new Date(order.scheduled_for).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </View>
      ) : null}

      {/* Vendor */}
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff5f0', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>🏪</Text>
        </View>
        <View>
          <Text style={{ fontSize: 11, color: '#aaa', fontWeight: '600' }}>FROM VENDOR</Text>
          <Text style={{ fontSize: 15, fontWeight: '900', color: '#1a1a1a', marginTop: 1 }}>
            {(order.vendor as { name?: string })?.name || 'Unknown vendor'}
          </Text>
        </View>
      </View>

      {/* Items for this vendor */}
      {order.order_items && order.order_items.length > 0 && (
        <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 6, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' }}>
          <Text style={{ fontSize: 11, color: '#aaa', fontWeight: '700' }}>ITEMS FOR THIS VENDOR</Text>
          {order.order_items.map((oi) => (
            <View key={oi.id} style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a' }}>{oi.quantity}× {oi.item_name}</Text>
              {(oi.plate_notes || []).some((n) => n?.trim()) && (
                <View style={{ marginTop: 2, marginLeft: 8, gap: 1 }}>
                  {oi.plate_notes.map((note, idx) => (note?.trim() ? (
                    <Text key={idx} style={{ fontSize: 11, color: '#888' }}>Plate {idx + 1}: {note}</Text>
                  ) : null))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Delivery Info */}
      <View style={{ padding: 14, gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 20 }}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: '#888', fontWeight: '600' }}>DROP-OFF LOCATION</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginTop: 2 }}>
              {(order.dropoff_location as { location_name?: string })?.location_name || 'Unknown location'}
            </Text>
            {order.location_description ? (
              <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{order.location_description}</Text>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 20 }}>👤</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: '#888', fontWeight: '600' }}>CUSTOMER</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginTop: 2 }}>
              {(order.customer as { name?: string })?.name || 'Unknown customer'}
            </Text>
          </View>
        </View>
        {order.delivery_notes ? (
          <View style={{ backgroundColor: '#fffbeb', padding: 10, borderRadius: 8 }}>
            <Text style={{ fontSize: 12, color: '#92400e' }}>📝 {order.delivery_notes}</Text>
          </View>
        ) : null}
      </View>

      {/* Delivery Code */}
      {order.delivery_code && order.status !== 'Cancelled' ? (
        <View style={{ marginHorizontal: 14, marginBottom: 12, backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#16a34a', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#166534', letterSpacing: 0.8 }}>🔐 CUSTOMER CODE</Text>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#16a34a', letterSpacing: 6, marginTop: 2 }}>
              {order.delivery_code}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: '#166534', maxWidth: 100, textAlign: 'right', lineHeight: 16 }}>
            Verify this code with the customer before handing over
          </Text>
        </View>
      ) : null}

      {/* Footer */}
      <View style={{ borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 11, color: '#888' }}>Order Value</Text>
            <Text style={{ fontSize: 15, fontWeight: '900', color: ORANGE }}>{formatNaira(order.total_price)}</Text>
          </View>
          {nextStatus && nextLabel ? (
            <Pressable
              onPress={onAdvance}
              disabled={updating}
              style={{ backgroundColor: nextStatus === 'Completed' ? '#16a34a' : ORANGE, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, opacity: updating ? 0.7 : 1 }}>
              {updating
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{nextLabel}</Text>}
            </Pressable>
          ) : order.status !== 'Cancelled' ? (
            <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
              <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '700' }}>✅ Delivered</Text>
            </View>
          ) : null}
        </View>

        {/* Cancel button row */}
        {canCancel ? (
          <Pressable
            onPress={onCancel}
            disabled={updating}
            style={{ borderWidth: 1.5, borderColor: '#dc2626', borderRadius: 10, paddingVertical: 9, alignItems: 'center', opacity: updating ? 0.5 : 1 }}>
            <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 13 }}>❌ Cancel Order</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
