/**
 * Admin — User & Customer Management
 * View customer profiles, balances, order count.
 * Award wallet credits or free delivery passes.
 */
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Users, Gift, Ticket, X, Check } from 'lucide-react-native';

import { getAdminCustomers } from '@/db/api';
import { supabase } from '@/client/supabase';
import type { AdminCustomerRow } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';

const ORANGE = '#F25C19';
const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';

type AwardType = 'credits' | 'passes';

export default function AdminUsers() {
  const router = useRouter();
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [awardTarget, setAwardTarget] = useState<AdminCustomerRow | null>(null);
  const [awardType, setAwardType] = useState<AwardType>('credits');
  const [awardAmount, setAwardAmount] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const data = await getAdminCustomers();
    setCustomers(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleAward = async () => {
    if (!awardTarget || !awardAmount || Number(awardAmount) <= 0) return;
    setAwarding(true);
    const { error } = await supabase.functions.invoke('admin-award-credits', {
      body: { targetUserId: awardTarget.id, type: awardType, amount: Number(awardAmount) },
    });
    setAwarding(false);
    setAwardTarget(null);
    setAwardAmount('');
    if (error) {
      setMsg({ text: 'Award failed. Try again.', ok: false });
    } else {
      setMsg({ text: `${awardType === 'credits' ? formatNaira(Number(awardAmount)) + ' credits' : awardAmount + ' pass(es)'} awarded to ${awardTarget.name}`, ok: true });
      await load();
    }
    setTimeout(() => setMsg(null), 3500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}><ArrowLeft size={22} color="#94a3b8" /></Pressable>
        <Users size={20} color={ORANGE} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 }}>User Management</Text>
        <Text style={{ color: '#64748b', fontSize: 12 }}>{customers.length} customers</Text>
      </View>

      {msg && (
        <View style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: msg.ok ? '#14532d' : '#450a0a', borderRadius: 10, padding: 10 }}>
          <Text style={{ color: msg.ok ? '#86efac' : '#fca5a5', fontSize: 13, textAlign: 'center' }}>{msg.text}</Text>
        </View>
      )}

      {loading
        ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={ORANGE} /></View>
        : (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
          >
            {customers.length === 0 && <Text style={{ color: '#475569', textAlign: 'center', marginTop: 40 }}>No customers found</Text>}
            {customers.map((c) => (
              <View key={c.id} style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: CARD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ORANGE + '33', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: ORANGE, fontWeight: '900', fontSize: 16 }}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{c.name}</Text>
                    <Text style={{ color: '#64748b', fontSize: 11 }}>{c.email}</Text>
                    {!!c.phone_number && <Text style={{ color: '#64748b', fontSize: 11 }}>{c.phone_number}</Text>}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 13 }}>{formatNaira(c.customer_balance)}</Text>
                    <Text style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>Wallet</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fbbf24', fontWeight: '800', fontSize: 13 }}>{c.active_passes} 🎟️</Text>
                    <Text style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>Active Passes</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#60a5fa', fontWeight: '800', fontSize: 13 }}>{c.total_orders}</Text>
                    <Text style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>Orders</Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => setAwardTarget(c)}
                  style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#334155', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 }}
                >
                  <Gift size={14} color={ORANGE} />
                  <Text style={{ color: ORANGE, fontWeight: '700', fontSize: 12 }}>Award Credits / Passes</Text>
                </Pressable>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

      {/* Award Modal */}
      <Modal visible={!!awardTarget} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1, borderColor: BORDER }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Award to {awardTarget?.name}</Text>
              <Pressable onPress={() => { setAwardTarget(null); setAwardAmount(''); }}><X size={20} color="#64748b" /></Pressable>
            </View>
            <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 18 }}>{awardTarget?.email}</Text>

            {/* Type selector */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {(['credits', 'passes'] as AwardType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setAwardType(t)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: awardType === t ? ORANGE : '#334155', borderRadius: 10, paddingVertical: 10 }}
                >
                  {t === 'credits' ? <Gift size={14} color={awardType === t ? '#fff' : '#94a3b8'} /> : <Ticket size={14} color={awardType === t ? '#fff' : '#94a3b8'} />}
                  <Text style={{ color: awardType === t ? '#fff' : '#94a3b8', fontWeight: '700', fontSize: 13 }}>
                    {t === 'credits' ? 'Wallet Credits' : 'Free Passes'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
              {awardType === 'credits' ? 'Amount (₦)' : 'Number of passes'}
            </Text>
            <TextInput
              value={awardAmount}
              onChangeText={setAwardAmount}
              placeholder={awardType === 'credits' ? '500' : '1'}
              placeholderTextColor="#475569"
              keyboardType="numeric"
              style={{ backgroundColor: BG, color: '#fff', borderRadius: 10, padding: 13, fontSize: 15, borderWidth: 1, borderColor: BORDER, marginBottom: 16 }}
            />

            <Pressable
              onPress={handleAward}
              style={{ backgroundColor: ORANGE, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {awarding ? <ActivityIndicator color="#fff" size="small" /> : <Check size={16} color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Confirm Award</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
