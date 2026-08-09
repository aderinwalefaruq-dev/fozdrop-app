/**
 * Admin — Platform Analytics
 * • Peak Ordering Hours bar chart
 * • Top 5 Selling Dishes
 * • Average Order Fulfillment Time
 * • Delivery Hotspots
 */
import {
  View, Text, ScrollView, ActivityIndicator, RefreshControl, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, BarChart2, Clock, MapPin, UtensilsCrossed } from 'lucide-react-native';

import {
  getAdminPeakHours, getAdminTopDishes, getAdminHotspots, getAdminAvgFulfillmentMinutes,
} from '@/db/api';
import type { PeakHourData, TopDishData, HotspotData } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';

const ORANGE = '#F25C19';
const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';

function PeakHoursChart({ data }: { data: PeakHourData[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  // Only show hours 6–23 for readability
  const visible = data.filter((d) => d.hour >= 6);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 80 }}>
      {visible.map(({ hour, count }) => {
        const pct = count / max;
        const barH = Math.max(4, Math.round(pct * 72));
        const isHot = count === max && count > 0;
        return (
          <View key={hour} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <View style={{ height: barH, width: '100%', backgroundColor: isHot ? ORANGE : '#334155', borderRadius: 3 }} />
            <Text style={{ color: '#475569', fontSize: 8 }}>{hour < 10 ? `0${hour}` : hour}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function AdminAnalytics() {
  const router = useRouter();
  const [peakHours, setPeakHours] = useState<PeakHourData[]>([]);
  const [topDishes, setTopDishes] = useState<TopDishData[]>([]);
  const [hotspots, setHotspots] = useState<HotspotData[]>([]);
  const [avgFulfillMin, setAvgFulfillMin] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [ph, td, hs, avg] = await Promise.all([
      getAdminPeakHours(),
      getAdminTopDishes(5),
      getAdminHotspots(),
      getAdminAvgFulfillmentMinutes(),
    ]);
    setPeakHours(ph);
    setTopDishes(td);
    setHotspots(hs);
    setAvgFulfillMin(avg);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const peakHour = peakHours.reduce((best, d) => d.count > best.count ? d : best, { hour: 0, count: 0 });
  const fmt12 = (h: number) => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}><ArrowLeft size={22} color="#94a3b8" /></Pressable>
        <BarChart2 size={20} color={ORANGE} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Platform Analytics</Text>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
      >
        {/* Peak Hours */}
        <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: CARD, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: BORDER }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Clock size={16} color={ORANGE} />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Peak Ordering Hours</Text>
          </View>
          <PeakHoursChart data={peakHours} />
          {peakHour.count > 0 && (
            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 10 }}>
              🔥 Busiest hour: <Text style={{ color: ORANGE, fontWeight: '800' }}>{fmt12(peakHour.hour)}</Text> ({peakHour.count} orders)
            </Text>
          )}
        </View>

        {/* Avg Fulfillment */}
        <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: CARD, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Clock size={32} color="#a78bfa" />
          <View>
            <Text style={{ color: '#a78bfa', fontSize: 32, fontWeight: '900' }}>{avgFulfillMin} min</Text>
            <Text style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Avg. Order Fulfillment Time</Text>
          </View>
        </View>

        {/* Top 5 Dishes */}
        <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: CARD, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: BORDER }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <UtensilsCrossed size={16} color={ORANGE} />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Top 5 Selling Dishes</Text>
          </View>
          {topDishes.length === 0
            ? <Text style={{ color: '#475569', fontSize: 13 }}>Not enough data yet</Text>
            : topDishes.map((dish, i) => (
              <View key={dish.item_name + dish.vendor_name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i < topDishes.length - 1 ? 1 : 0, borderBottomColor: BORDER }}>
                <Text style={{ color: i === 0 ? ORANGE : '#64748b', fontWeight: '900', fontSize: 16, width: 20 }}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 13 }}>{dish.item_name}</Text>
                  <Text style={{ color: '#64748b', fontSize: 11 }}>{dish.vendor_name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 12 }}>{formatNaira(dish.total_revenue)}</Text>
                  <Text style={{ color: '#64748b', fontSize: 10 }}>{dish.total_orders} orders</Text>
                </View>
              </View>
            ))}
        </View>

        {/* Delivery Hotspots */}
        <View style={{ marginHorizontal: 16, marginBottom: 32, backgroundColor: CARD, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: BORDER }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <MapPin size={16} color={ORANGE} />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Delivery Hotspots</Text>
          </View>
          {hotspots.length === 0
            ? <Text style={{ color: '#475569', fontSize: 13 }}>No delivery data yet</Text>
            : hotspots.map((spot, i) => {
              const max = hotspots[0]?.order_count ?? 1;
              const pct = spot.order_count / max;
              return (
                <View key={spot.location_name} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{spot.location_name}</Text>
                    <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 12 }}>{spot.order_count}</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: BORDER, borderRadius: 3 }}>
                    <View style={{ height: 6, width: `${Math.round(pct * 100)}%`, backgroundColor: i === 0 ? ORANGE : '#334155', borderRadius: 3 }} />
                  </View>
                </View>
              );
            })}
        </View>
      </ScrollView>
    </View>
  );
}
