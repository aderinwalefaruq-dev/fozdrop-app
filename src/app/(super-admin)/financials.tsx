/**
 * Admin — Financial Overview
 * Complete transaction ledger. Filter by type / date. CSV export.
 */
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, DollarSign, Download } from 'lucide-react-native';

import { getAdminTransactions } from '@/db/api';
import type { AdminTransactionRow } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';

const ORANGE = '#F25C19';
const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';

const TX_TYPES = ['', 'Credit', 'Debit', 'Refund'];
const TX_COLOR: Record<string, string> = { Credit: '#22c55e', Debit: '#f87171', Refund: '#60a5fa' };

export default function AdminFinancials() {
  const router = useRouter();
  const [txns, setTxns] = useState<AdminTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(async () => {
    const data = await getAdminTransactions({ txType: typeFilter || undefined, limit: 100 });
    setTxns(data);
    setLoading(false);
  }, [typeFilter]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const exportCSV = () => {
    const header = 'Date,Type,Amount,Reference,Description';
    const rows = txns.map((t) =>
      [new Date(t.created_at).toLocaleString(), t.transaction_type, t.amount, t.reference_id, `"${t.description}"`].join(',')
    );
    const csv = [header, ...rows].join('\n');
    // CSV download is only possible on Web — document.createElement('a') doesn't
    // exist on native (React Native has no DOM), so guard with EXPO_OS.
    if (process.env.EXPO_OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fozdrop-transactions-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const totalCredit = txns.filter((t) => t.transaction_type === 'Credit').reduce((s, t) => s + t.amount, 0);
  const totalDebit = txns.filter((t) => t.transaction_type === 'Debit').reduce((s, t) => s + t.amount, 0);
  const totalRefund = txns.filter((t) => t.transaction_type === 'Refund').reduce((s, t) => s + t.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}><ArrowLeft size={22} color="#94a3b8" /></Pressable>
        <DollarSign size={20} color={ORANGE} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 }}>Financials</Text>
        <Pressable
          onPress={exportCSV}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Download size={14} color="#94a3b8" />
          <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700' }}>CSV</Text>
        </Pressable>
      </View>

      {/* Summary cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 12 }}>
        {[
          { label: 'Total Credits', value: formatNaira(totalCredit), color: '#22c55e' },
          { label: 'Total Debits',  value: formatNaira(totalDebit),  color: '#f87171' },
          { label: 'Total Refunds', value: formatNaira(totalRefund), color: '#60a5fa' },
          { label: 'Net Flow',      value: formatNaira(totalCredit - totalDebit - totalRefund), color: ORANGE },
        ].map(({ label, value, color }) => (
          <View key={label} style={{ backgroundColor: CARD, borderRadius: 14, padding: 14, minWidth: 130, borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ color, fontSize: 16, fontWeight: '900' }}>{value}</Text>
            <Text style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Type filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}>
        {TX_TYPES.map((t) => (
          <Pressable
            key={t || 'all'}
            onPress={() => setTypeFilter(t)}
            style={{ backgroundColor: typeFilter === t ? ORANGE : CARD, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: typeFilter === t ? ORANGE : BORDER }}
          >
            <Text style={{ color: typeFilter === t ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: '700' }}>{t || 'All'}</Text>
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
            {txns.length === 0 && <Text style={{ color: '#475569', textAlign: 'center', marginTop: 40 }}>No transactions</Text>}
            {txns.map((t) => (
              <View key={t.id} style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: CARD, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: (TX_COLOR[t.transaction_type] ?? '#94a3b8') + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: TX_COLOR[t.transaction_type] ?? '#94a3b8', fontSize: 11, fontWeight: '800' }}>{t.transaction_type.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{t.description || t.reference_id}</Text>
                  <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{new Date(t.created_at).toLocaleString()}</Text>
                </View>
                <Text style={{ color: TX_COLOR[t.transaction_type] ?? '#94a3b8', fontWeight: '800', fontSize: 13 }}>
                  {t.transaction_type === 'Debit' ? '-' : '+'}{formatNaira(t.amount)}
                </Text>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
    </View>
  );
}
