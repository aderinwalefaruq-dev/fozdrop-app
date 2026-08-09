import {
  View, Text, FlatList, Pressable, TextInput,
  ActivityIndicator, Modal, KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '@/ctx';
import {
  getWallet, getTransactions, getBankDetails, saveBankDetails,
  requestWithdrawal, getWithdrawalRequests,
} from '@/db/api';
import type { Wallet, Transaction, BankDetails, WithdrawalRequest } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';

const ORANGE = '#F25C19';
const CREAM = '#FAF6F0';

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  Pending:  { bg: '#fff8f0', text: '#92400e', label: '⏳ Pending' },
  Approved: { bg: '#dcfce7', text: '#166534', label: '✅ Approved' },
  Rejected: { bg: '#fee2e2', text: '#991b1b', label: '❌ Rejected' },
};

export default function VendorWalletScreen() {
  const { session } = useSession();
  const userId = session?.user?.id ?? '';

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Bank details form
  const [editingBank, setEditingBank] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [bankError, setBankError] = useState('');
  const [bankSuccess, setBankSuccess] = useState(false);

  // Withdrawal modal
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const [w, t, bd, wr] = await Promise.all([
      getWallet(userId),
      getTransactions(userId),
      getBankDetails(userId),
      getWithdrawalRequests(userId),
    ]);
    setWallet(w);
    setTransactions(t);
    setBankDetails(bd);
    if (bd) { setBankName(bd.bank_name); setAccountNumber(bd.account_number); setAccountName(bd.account_name); }
    setWithdrawalRequests(wr);
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const handleSaveBank = async () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      setBankError('All fields are required'); return;
    }
    if (!/^\d{10}$/.test(accountNumber.trim())) {
      setBankError('Account number must be exactly 10 digits'); return;
    }
    setSavingBank(true); setBankError('');
    const { error } = await saveBankDetails(userId, {
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(),
      accountName: accountName.trim(),
    });
    setSavingBank(false);
    if (error) { setBankError(error); return; }
    setBankSuccess(true);
    setEditingBank(false);
    loadData();
    setTimeout(() => setBankSuccess(false), 4000);
  };

  const handleWithdraw = async () => {
    const balance = wallet?.vendor_balance ?? 0;
    const amt = parseFloat(withdrawAmount);
    if (!withdrawAmount || isNaN(amt) || amt <= 0) { setWithdrawError('Enter a valid amount'); return; }
    if (amt < 500) { setWithdrawError('Minimum withdrawal is ₦500'); return; }
    if (amt > balance) { setWithdrawError(`Amount cannot exceed your balance of ${formatNaira(balance)}`); return; }
    if (!bankDetails) { setWithdrawError('Please save your bank details first'); return; }
    setWithdrawing(true); setWithdrawError('');
    const result = await requestWithdrawal(amt);
    setWithdrawing(false);
    if (!result.success) { setWithdrawError(result.error ?? 'Request failed'); return; }
    setShowWithdraw(false);
    setWithdrawAmount('');
    setSuccessMsg(`Withdrawal request of ${formatNaira(amt)} submitted! It has been deducted from your balance. Your bank account will be credited within 24 hours.`);
    loadData();
    setTimeout(() => setSuccessMsg(''), 7000);
  };

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

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <View>
            {/* ── Balance Header ── */}
            <View style={{ backgroundColor: ORANGE, paddingTop: 56, paddingBottom: 28, paddingHorizontal: 24 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 4 }}>Vendor Earnings</Text>
              <Text style={{ color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: 0.5 }}>
                {formatNaira(wallet?.vendor_balance ?? 0)}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>
                Your share from food orders (delivery fee excluded)
              </Text>
              <Pressable
                onPress={() => { setShowWithdraw(true); setWithdrawError(''); setWithdrawAmount(''); }}
                style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16 }}>💸</Text>
                <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 14 }}>Withdraw Funds</Text>
              </Pressable>
            </View>

            {/* ── Success Banner ── */}
            {successMsg ? (
              <View style={{ backgroundColor: '#dcfce7', padding: 14, marginHorizontal: 16, marginTop: 12, borderRadius: 10 }}>
                <Text style={{ color: '#166534', fontSize: 13, fontWeight: '600' }}>✅ {successMsg}</Text>
              </View>
            ) : null}
            {bankSuccess ? (
              <View style={{ backgroundColor: '#dcfce7', padding: 14, marginHorizontal: 16, marginTop: 12, borderRadius: 10 }}>
                <Text style={{ color: '#166534', fontSize: 13, fontWeight: '600' }}>✅ Bank details saved successfully!</Text>
              </View>
            ) : null}

            {/* ── Bank Details Card ── */}
            <View style={{ margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff5f0', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 17 }}>🏦</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a' }}>Bank Details</Text>
                </View>
                <Pressable
                  onPress={() => { setEditingBank(!editingBank); setBankError(''); }}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: editingBank ? '#fee2e2' : '#fff5f0' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: editingBank ? '#dc2626' : ORANGE }}>
                    {editingBank ? 'Cancel' : (bankDetails ? 'Edit' : 'Add')}
                  </Text>
                </Pressable>
              </View>

              {!editingBank && bankDetails ? (
                <View style={{ gap: 10 }}>
                  <BankRow label="Bank Name" value={bankDetails.bank_name} />
                  <BankRow label="Account Number" value={bankDetails.account_number} mono />
                  <BankRow label="Account Name" value={bankDetails.account_name} />
                </View>
              ) : !editingBank ? (
                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <Text style={{ fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 }}>
                    No bank details saved yet.{'\n'}Add your account to enable withdrawals.
                  </Text>
                  <Pressable
                    onPress={() => setEditingBank(true)}
                    style={{ marginTop: 12, backgroundColor: ORANGE, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Add Bank Details</Text>
                  </Pressable>
                </View>
              ) : null}

              {editingBank && (
                <View style={{ gap: 12 }}>
                  <BankInput label="Bank Name" placeholder="e.g. First Bank, GTBank" value={bankName} onChangeText={setBankName} />
                  <BankInput label="Account Number" placeholder="10-digit account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" maxLength={10} />
                  <BankInput label="Account Name" placeholder="Name on account" value={accountName} onChangeText={setAccountName} />
                  {bankError ? <Text style={{ color: '#dc2626', fontSize: 12, marginTop: -4 }}>{bankError}</Text> : null}
                  <Pressable onPress={handleSaveBank} disabled={savingBank}
                    style={{ backgroundColor: ORANGE, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 4, opacity: savingBank ? 0.7 : 1 }}>
                    {savingBank ? <ActivityIndicator color="#fff" /> : (
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Save Bank Details</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>

            {/* ── Withdrawal Requests ── */}
            {withdrawalRequests.length > 0 && (
              <View style={{ marginHorizontal: 16, marginBottom: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 10 }}>Withdrawal Requests</Text>
                {withdrawalRequests.map((req) => {
                  const s = STATUS_STYLE[req.status] ?? STATUS_STYLE.Pending;
                  const date = new Date(req.created_at);
                  return (
                    <View key={req.id} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a' }}>{formatNaira(req.amount)}</Text>
                        <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                          {req.bank_name} · {req.account_number}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>
                          {date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                        {req.notes ? <Text style={{ fontSize: 11, color: '#666', marginTop: 3, fontStyle: 'italic' }}>{req.notes}</Text> : null}
                      </View>
                      <View style={{ backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: s.text }}>{s.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Transaction History Header ── */}
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginHorizontal: 16, marginTop: 8, marginBottom: 8 }}>
              Transaction History
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 36 }}>💰</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#555', marginTop: 10 }}>No transactions yet</Text>
            <Text style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Earnings from orders will appear here</Text>
          </View>
        }
        renderItem={({ item }) => <TransactionRow item={item} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 8 }}
      />

      {/* ── Withdraw Modal ── */}
      <Modal visible={showWithdraw} transparent animationType="slide" onRequestClose={() => setShowWithdraw(false)}>
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowWithdraw(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#e5e5e5', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 }}>Withdraw Funds</Text>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              Available:{' '}
              <Text style={{ fontWeight: '800', color: ORANGE }}>{formatNaira(wallet?.vendor_balance ?? 0)}</Text>
              {'  '}•{'  '}Min: ₦500
            </Text>

            {/* Bank summary */}
            {bankDetails ? (
              <View style={{ backgroundColor: '#f9f9f9', borderRadius: 10, padding: 12, marginBottom: 16, gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Paying to</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>{bankDetails.account_name}</Text>
                <Text style={{ fontSize: 13, color: '#555' }}>{bankDetails.bank_name} · {bankDetails.account_number}</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#fff8f0', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fed7aa' }}>
                <Text style={{ fontSize: 13, color: '#92400e', fontWeight: '600' }}>
                  ⚠️ No bank details saved. Close this and add your bank details first.
                </Text>
              </View>
            )}

            {/* Amount input */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 }}>Amount to withdraw</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 13, marginBottom: 4 }}>
              <Text style={{ fontSize: 16, color: '#888', marginRight: 4 }}>₦</Text>
              <TextInput
                style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#1a1a1a', paddingVertical: 13 }}
                placeholder="0.00"
                placeholderTextColor="#bbb"
                value={withdrawAmount}
                onChangeText={(v) => { setWithdrawAmount(v); setWithdrawError(''); }}
                keyboardType="numeric"
              />
              {/* Withdraw all shortcut */}
              <Pressable
                onPress={() => { setWithdrawAmount(String(wallet?.vendor_balance ?? 0)); setWithdrawError(''); }}
                style={{ backgroundColor: '#fff5f0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: ORANGE }}>Max</Text>
              </Pressable>
            </View>

            {withdrawError ? (
              <Text style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{withdrawError}</Text>
            ) : <View style={{ height: 12 }} />}

            <View style={{ backgroundColor: '#fff8f0', padding: 12, borderRadius: 10, marginBottom: 16 }}>
              <Text style={{ fontSize: 12, color: '#92400e', fontWeight: '600' }}>
                ℹ️ This amount is deducted from your balance immediately. Your bank account will be credited manually within 24 hours.
              </Text>
            </View>

            <Pressable
              onPress={handleWithdraw}
              disabled={withdrawing || !bankDetails || (wallet?.vendor_balance ?? 0) < 500}
              style={{ backgroundColor: ORANGE, padding: 16, borderRadius: 12, alignItems: 'center', opacity: (withdrawing || !bankDetails || (wallet?.vendor_balance ?? 0) < 500) ? 0.5 : 1 }}>
              {withdrawing ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Request Withdrawal</Text>
              )}
            </Pressable>
            <View style={{ height: 20 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Helpers ──

function BankRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 12, color: '#888', fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a', fontFamily: mono ? 'monospace' : undefined, letterSpacing: mono ? 1 : 0 }}>
        {value}
      </Text>
    </View>
  );
}

function BankInput({
  label, placeholder, value, onChangeText, keyboardType, maxLength,
}: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void; keyboardType?: 'numeric'; maxLength?: number;
}) {
  return (
    <View>
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#444', marginBottom: 5 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a1a' }}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
      />
    </View>
  );
}

function TransactionRow({ item }: { item: Transaction }) {
  const isCredit = item.transaction_type === 'Credit';
  const date = new Date(item.created_at);
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: isCredit ? '#dcfce7' : '#fee2e2', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18 }}>{isCredit ? '⬆️' : '⬇️'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a' }} numberOfLines={1}>
          {item.description || item.transaction_type}
        </Text>
        <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
          {date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
          {' • '}
          {date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '800', color: isCredit ? '#16a34a' : '#dc2626' }}>
        {isCredit ? '+' : '-'}{formatNaira(item.amount)}
      </Text>
    </View>
  );
}

