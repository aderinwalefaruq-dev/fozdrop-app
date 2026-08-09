import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '@/ctx';
import { getCustomerOrders } from '@/db/api';
import type { Order } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';

const ORANGE = '#F25C19';
const CREAM = '#FAF6F0';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Pending:          { bg: '#fef3c7', text: '#92400e' },
  Preparing:        { bg: '#dbeafe', text: '#1d4ed8' },
  'Out for Delivery': { bg: '#ede9fe', text: '#6d28d9' },
  'Arrived at Dropoff': { bg: '#d1fae5', text: '#065f46' },
  Completed:        { bg: '#f0fdf4', text: '#166534' },
};

const STATUS_ICONS: Record<string, string> = {
  Pending: '🕐',
  Preparing: '👨‍🍳',
  'Out for Delivery': '🛵',
  'Arrived at Dropoff': '📍',
  Completed: '✅',
};

export default function OrdersTab() {
  const { session } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); setRefreshing(false); return; }
    const data = await getCustomerOrders(session.user.id);
    setOrders(data);
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(useCallback(() => { setLoading(true); loadOrders(); }, [loadOrders]));
  const onRefresh = () => { setRefreshing(true); loadOrders(); };

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
      <View style={{ backgroundColor: ORANGE, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>My Orders</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>Track your food orders</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 48 }}>🛵</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginTop: 16 }}>No orders yet</Text>
            <Text style={{ fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center' }}>
              Browse vendors from the Home tab to place your first order
            </Text>
          </View>
        }
        renderItem={({ item }) => <OrderCard order={item} />}
      />
    </View>
  );
}

function OrderCard({ order }: { order: Order }) {
  const sc = STATUS_COLORS[order.status] || { bg: '#f5f5f5', text: '#555' };
  const icon = STATUS_ICONS[order.status] || '📦';
  const date = new Date(order.created_at);
  const items = order.order_items as Array<{ item_name: string; quantity: number; price: number }> || [];

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <View>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a1a' }}>#{order.order_ref}</Text>
          <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} • {date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: sc.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
          <Text style={{ fontSize: 12 }}>{icon}</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: sc.text }}>{order.status}</Text>
        </View>
      </View>

      {/* Vendor */}
      <Text style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
        🏪 {(order.vendor as { name?: string })?.name || 'Vendor'}
      </Text>

      {/* Items */}
      {items.slice(0, 3).map((it, idx) => (
        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 13, color: '#555' }}>{it.quantity}× {it.item_name}</Text>
          <Text style={{ fontSize: 13, color: '#555' }}>{formatNaira(it.price * it.quantity)}</Text>
        </View>
      ))}
      {items.length > 3 && (
        <Text style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>+{items.length - 3} more items</Text>
      )}

      {/* Dropoff */}
      {(order.dropoff_location as { location_name?: string })?.location_name ? (
        <Text style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
          📍 {(order.dropoff_location as { location_name?: string }).location_name}
        </Text>
      ) : null}

      {/* Delivery Code — shown for all active (non-completed) orders */}
      {order.status !== 'Completed' && order.delivery_code ? (
        <View style={{ marginTop: 12, backgroundColor: '#fff7ed', borderWidth: 1.5, borderColor: ORANGE, borderRadius: 12, padding: 14, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#9a3412', letterSpacing: 1, marginBottom: 4 }}>
            🔐 YOUR DELIVERY CODE
          </Text>
          <Text style={{ fontSize: 32, fontWeight: '900', color: ORANGE, letterSpacing: 6 }}>
            {order.delivery_code}
          </Text>
          <Text style={{ fontSize: 11, color: '#9a3412', marginTop: 6, textAlign: 'center' }}>
            Show this code to the delivery runner to collect your order
          </Text>
        </View>
      ) : null}

      {/* Total */}
      <View style={{ borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 12, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: '#888' }}>
          Delivery: {formatNaira(order.delivery_fee)}
          {order.packaging_fee > 0 ? ` · Packaging: ${formatNaira(order.packaging_fee)}` : ''}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: '900', color: ORANGE }}>{formatNaira(order.total_price)}</Text>
      </View>
    </View>
  );
}
