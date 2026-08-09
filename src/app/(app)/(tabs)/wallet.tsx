import {
  View, Text, FlatList, Pressable, TextInput,
  ActivityIndicator, Modal, KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useSession } from '@/ctx';
import { getWallet, getTransactions } from '@/db/api';
import { supabase } from '@/client/supabase';
import type { Wallet, Transaction } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';

const ORANGE = '#F25C19';
const CREAM = '#FAF6F0';

const TOPUP_AMOUNTS = [500, 1000, 2000, 5000];

export default function WalletTab() {
  const { session } = useSession();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topping, setTopping] = useState(false);
  const [topUpError, setTopUpError] = useState('');
  const [topUpSuccess, setTopUpSuccess] = useState<number | null>(null);
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [showRecover, setShowRecover] = useState(false);
  const [recoverRef, setRecoverRef] = useState('');
  const [recoverError, setRecoverError] = useState('');
  const [recoverLoading, setRecoverLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); return; }
    const [w, t] = await Promise.all([
      getWallet(session.user.id),
      getTransactions(session.user.id),
    ]);
    setWallet(w);
    setTransactions(t);
    setLoading(false);
  }, [session]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const verifyPayment = async (reference: string) => {
    setVerifying(true);
    setTopUpError('');
    try {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('paystack-verify', {
        body: { reference, userId: session!.user!.id },
      });
      if (verifyError || !verifyData?.success) {
        const msg = verifyError ? await verifyError?.context?.text() : null;
        setTopUpError(msg || 'Payment could not be verified. If debited, contact support.');
      } else {
        setShowTopUp(false);
        setTopUpAmount('');
        setPendingReference(null);
        setTopUpSuccess(verifyData.amount);
        loadData();
      }
    } catch {
      setTopUpError('Something went wrong. Please try again.');
    }
    setVerifying(false);
  };

  const handleRecover = async () => {
    const ref = recoverRef.trim();
    if (!ref) { setRecoverError('Please enter a payment reference'); return; }
    setRecoverLoading(true); setRecoverError('');
    try {
      const { data, error } = await supabase.functions.invoke('paystack-verify', {
        body: { reference: ref, userId: session!.user!.id },
      });
      if (error || !data?.success) {
        const msg = error ? await error?.context?.text() : null;
        setRecoverError(msg || 'Could not verify this reference. Check the ref and try again.');
      } else {
        setShowRecover(false);
        setRecoverRef('');
        setTopUpSuccess(data.amount);
        loadData();
      }
    } catch {
      setRecoverError('Something went wrong. Please try again.');
    }
    setRecoverLoading(false);
  };

  const handleTopUp = async () => {
    const amt = parseFloat(topUpAmount);
    if (!amt || amt <= 0) { setTopUpError('Enter a valid amount'); return; }
    if (amt < 100) { setTopUpError('Minimum top-up is ₦100'); return; }
    setTopping(true); setTopUpError('');

    try {
      // 1. Initialize Paystack transaction via Edge Function
      const { data: initData, error: initError } = await supabase.functions.invoke('paystack-initialize', {
        body: { amount: amt, email: session!.user!.email },
      });
      if (initError || !initData?.authorization_url) {
        const msg = initError ? await initError?.context?.text() : 'Failed to initialize payment';
        setTopUpError(msg || 'Failed to initialize payment');
        setTopping(false);
        return;
      }

      // 2. Store reference NOW before opening browser — ensures fallback verify
      //    button is always available regardless of what happens next.
      setPendingReference(initData.reference);

      // 3. Open Paystack payment page in browser
      const result = await WebBrowser.openBrowserAsync(initData.authorization_url, {
        dismissButtonStyle: 'close',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });

      setTopping(false);

      // 4. On web, browser opens in a new tab and returns 'opened' immediately —
      //    keep the pending reference and show the manual verify button.
      if (process.env.EXPO_OS === 'web' || result.type === 'opened') {
        return;
      }

      // 5. On mobile, auto-verify whenever the browser closes (dismiss OR cancel).
      //    Android can return 'cancel' instead of 'dismiss' — handle both.
      await verifyPayment(initData.reference);
    } catch {
      setTopUpError('Something went wrong. Please try again.');
      setTopping(false);
    }
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

      {/* Balance Card */}
      <View style={{ backgroundColor: ORANGE, paddingTop: 56, paddingBottom: 28, paddingHorizontal: 24 }}>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 4 }}>Available Balance</Text>
        <Text style={{ color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: 0.5 }}>
          {formatNaira(wallet?.customer_balance ?? 0)}
        </Text>
        <Pressable
          onPress={() => { setShowTopUp(true); setTopUpError(''); setTopUpSuccess(null); }}
          style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: ORANGE }}>+</Text>
          <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 14 }}>Top Up via Paystack</Text>
        </Pressable>
        <Pressable
          onPress={() => { setShowRecover(true); setRecoverRef(''); setRecoverError(''); }}
          style={{ marginTop: 10 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, textDecorationLine: 'underline' }}>
            Paid but balance didn't update? Recover payment
          </Text>
        </Pressable>
      </View>

      {/* Success Banner */}
      {topUpSuccess !== null && (
        <View style={{ backgroundColor: '#dcfce7', margin: 16, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 22 }}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: '#166534' }}>Top-up Successful!</Text>
            <Text style={{ fontSize: 13, color: '#166534', marginTop: 2 }}>
              {formatNaira(topUpSuccess)} added to your wallet.
            </Text>
          </View>
          <Pressable onPress={() => setTopUpSuccess(null)}>
            <Text style={{ color: '#166534', fontWeight: '700' }}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Transaction History */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListHeaderComponent={
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 }}>
            Transaction History
          </Text>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 36 }}>💳</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#555', marginTop: 10 }}>No transactions yet</Text>
            <Text style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Top up your wallet to get started</Text>
          </View>
        }
        renderItem={({ item }) => <TransactionRow item={item} />}
      />

      {/* Top Up Modal */}
      <Modal visible={showTopUp} transparent animationType="slide" onRequestClose={() => setShowTopUp(false)}>
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowTopUp(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#e5e5e5', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 }}>Top Up Wallet</Text>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
              Pay securely via Paystack — card, bank transfer, USSD
            </Text>

            <Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 8 }}>Quick amounts</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {TOPUP_AMOUNTS.map((amt) => (
                <Pressable key={amt} onPress={() => setTopUpAmount(String(amt))}
                  style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 2,
                    borderColor: topUpAmount === String(amt) ? ORANGE : '#ddd',
                    backgroundColor: topUpAmount === String(amt) ? '#fff5f0' : '#fff' }}>
                  <Text style={{ fontWeight: '700', color: topUpAmount === String(amt) ? ORANGE : '#555' }}>
                    {formatNaira(amt)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 }}>Or enter amount</Text>
            <TextInput
              style={{ backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 13, fontSize: 16, color: '#1a1a1a' }}
              placeholder="₦ Enter amount"
              value={topUpAmount}
              onChangeText={setTopUpAmount}
              keyboardType="numeric"
            />
            {topUpError ? <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{topUpError}</Text> : null}

            {/* Pending verification banner (web / new-tab flow) */}
            {pendingReference ? (
              <View style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 12, padding: 14, marginTop: 16, gap: 10 }}>
                <Text style={{ fontSize: 13, color: '#92400e', fontWeight: '700', textAlign: 'center' }}>
                  ⏳ Complete payment in the browser, then tap below to credit your wallet
                </Text>
                <Pressable
                  onPress={() => verifyPayment(pendingReference)}
                  disabled={verifying}
                  style={{ backgroundColor: '#16a34a', padding: 14, borderRadius: 10, alignItems: 'center', opacity: verifying ? 0.7 : 1 }}>
                  {verifying
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>✅ I've Paid — Verify Now</Text>}
                </Pressable>
                <Pressable onPress={() => setPendingReference(null)} style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#92400e' }}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={handleTopUp} disabled={topping}
                style={{ backgroundColor: ORANGE, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20, opacity: topping ? 0.7 : 1 }}>
                {topping
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Pay with Paystack 🔒</Text>}
              </Pressable>
            )}
            <View style={{ height: 20 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Recover Payment Modal */}
      <Modal visible={showRecover} transparent animationType="slide" onRequestClose={() => setShowRecover(false)}>
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowRecover(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#e5e5e5', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 }}>Recover a Payment</Text>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 20 }}>
              If you were charged but your balance didn't update, enter the Paystack reference from your email/SMS receipt below.
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 }}>Paystack Reference</Text>
            <TextInput
              style={{ backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 13, fontSize: 14, color: '#1a1a1a', letterSpacing: 0.5 }}
              placeholder="e.g. xkcdabcd1234"
              value={recoverRef}
              onChangeText={setRecoverRef}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {recoverError ? (
              <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{recoverError}</Text>
            ) : null}
            <Pressable
              onPress={handleRecover}
              disabled={recoverLoading}
              style={{ backgroundColor: '#16a34a', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 18, opacity: recoverLoading ? 0.7 : 1 }}>
              {recoverLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>✅ Verify & Credit Wallet</Text>}
            </Pressable>
            <Pressable onPress={() => setShowRecover(false)} style={{ alignItems: 'center', marginTop: 12 }}>
              <Text style={{ fontSize: 13, color: '#888' }}>Cancel</Text>
            </Pressable>
            <View style={{ height: 16 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function TransactionRow({ item }: { item: Transaction }) {
  const isCredit = item.transaction_type === 'Credit';
  const date = new Date(item.created_at);
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: isCredit ? '#dcfce7' : '#fee2e2', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18 }}>{isCredit ? '⬆️' : '⬇️'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a' }} numberOfLines={1}>
          {item.description || item.transaction_type}
        </Text>
        <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
          {date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
        {item.reference_id ? (
          <Text style={{ fontSize: 10, color: '#bbb', marginTop: 2, letterSpacing: 0.3 }} numberOfLines={1}>
            Ref: {item.reference_id}
          </Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 15, fontWeight: '800', color: isCredit ? '#16a34a' : '#dc2626' }}>
        {isCredit ? '+' : '-'}{formatNaira(item.amount)}
      </Text>
    </View>
  );
}
