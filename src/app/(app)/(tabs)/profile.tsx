import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '@/ctx';
import { getProfile, updateProfile, getWallet, getReferralStats, getActiveFreeDeliveryPasses, buyDeliveryPass } from '@/db/api';
import type { Profile, Wallet, ReferralStats, FreeDeliveryPass } from '@/types/types';
import { supabase } from '@/client/supabase';
import { formatNaira } from '@/lib/utils/format';

const ORANGE = '#F25C19';
const CREAM = '#FAF6F0';

const ROLE_ICONS: Record<string, string> = {
  Customer: '🎓',
  Vendor: '🏪',
  Operator: '🛵',
};

export default function ProfileTab() {
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [referral, setReferral] = useState<ReferralStats | null>(null);
  const [passes, setPasses] = useState<FreeDeliveryPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [buyingPass, setBuyingPass] = useState(false);
  const [buyPassMsg, setBuyPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); return; }
    const [p, w, ref, activePasses] = await Promise.all([
      getProfile(session.user.id),
      getWallet(session.user.id),
      getReferralStats(session.user.id),
      getActiveFreeDeliveryPasses(session.user.id),
    ]);
    setProfile(p);
    setWallet(w);
    setReferral(ref);
    setPasses(activePasses);
    if (p) { setEditName(p.name); setEditPhone(p.phone_number); }
    setLoading(false);
  }, [session]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const handleSave = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    await updateProfile(session.user.id, { name: editName.trim(), phone_number: editPhone.trim() });
    setSaving(false);
    setEditing(false);
    loadData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const referralCode = referral?.referral_code ?? '';

  const handleCopyLink = async () => {
    if (!referralCode) return;
    if (process.env.EXPO_OS === 'web' && navigator?.clipboard) {
      await navigator.clipboard.writeText(referralCode);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!referralCode) return;
    const msg = encodeURIComponent(
      `Hey! I use Fozdrop for campus food delivery at Bells University. Sign up and enter my referral code *${referralCode}* — your first order earns me a Free Delivery Pass! 🍔🎟️`
    );
    Linking.openURL(`https://wa.me/?text=${msg}`);
  };

  const handleBuyPass = async () => {
    if (!session?.user?.id) return;
    if ((wallet?.customer_balance ?? 0) < 200) {
      setBuyPassMsg({ type: 'error', text: 'Insufficient balance. Top up your wallet first.' });
      return;
    }
    setBuyingPass(true);
    setBuyPassMsg(null);
    const result = await buyDeliveryPass(session.user.id);
    setBuyingPass(false);
    if (result.success) {
      setBuyPassMsg({ type: 'success', text: '🎟️ Pass purchased! Valid for 24 hours.' });
      loadData(); // refresh wallet + passes
    } else {
      setBuyPassMsg({ type: 'error', text: result.error ?? 'Purchase failed. Try again.' });
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  const isVendorOrOp = profile?.role === 'Vendor' || profile?.role === 'Operator';

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ backgroundColor: ORANGE, paddingTop: 56, paddingBottom: 32, alignItems: 'center' }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            {profile?.profile_image ? (
              <Image source={{ uri: profile.profile_image }} style={{ width: 80, height: 80, borderRadius: 40 }} contentFit="cover" />
            ) : (
              <Text style={{ fontSize: 36 }}>{ROLE_ICONS[profile?.role || 'Customer']}</Text>
            )}
          </View>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{profile?.name || 'User'}</Text>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 6 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{profile?.role}</Text>
          </View>
        </View>

        {/* Balance Card (visible to all roles) */}
        <View style={{ margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }}>
          <Text style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
            {isVendorOrOp ? 'Vendor Earnings' : 'Wallet Balance'}
          </Text>
          <Text style={{ fontSize: 28, fontWeight: '900', color: ORANGE }}>
            {isVendorOrOp ? formatNaira(wallet?.vendor_balance ?? 0) : formatNaira(wallet?.customer_balance ?? 0)}
          </Text>
        </View>

        {/* Buy a Delivery Pass — Customers only */}
        {profile?.role === 'Customer' && (
          <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 }}>🛒 Buy a Free Delivery Pass</Text>
            <Text style={{ fontSize: 12, color: '#888', marginBottom: 16, lineHeight: 18 }}>
              Skip the delivery fee on your next order. Each pass is valid for 24 hours and covers 1 order.
            </Text>

            {/* Price row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff7ed', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: '#fed7aa' }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400e' }}>1× Free Delivery Pass</Text>
                <Text style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>100% off delivery fee · 24-hour expiry</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '900', color: ORANGE }}>₦200</Text>
            </View>

            {/* Feedback message */}
            {buyPassMsg && (
              <View style={{
                backgroundColor: buyPassMsg.type === 'success' ? '#f0fdf4' : '#fee2e2',
                borderRadius: 10, padding: 12, marginBottom: 12,
                borderWidth: 1, borderColor: buyPassMsg.type === 'success' ? '#bbf7d0' : '#fca5a5',
              }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: buyPassMsg.type === 'success' ? '#166534' : '#dc2626' }}>
                  {buyPassMsg.text}
                </Text>
              </View>
            )}

            {/* Wallet balance hint */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 12, color: '#888' }}>Your wallet balance</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: (wallet?.customer_balance ?? 0) >= 200 ? '#16a34a' : '#dc2626' }}>
                {formatNaira(wallet?.customer_balance ?? 0)}
              </Text>
            </View>

            {/* Buy button */}
            <Pressable
              onPress={handleBuyPass}
              disabled={buyingPass || (wallet?.customer_balance ?? 0) < 200}
              style={{
                backgroundColor: (wallet?.customer_balance ?? 0) >= 200 ? ORANGE : '#e5e5e5',
                borderRadius: 12, padding: 14, alignItems: 'center',
                opacity: buyingPass ? 0.7 : 1,
              }}
            >
              {buyingPass
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: (wallet?.customer_balance ?? 0) >= 200 ? '#fff' : '#999', fontWeight: '800', fontSize: 14 }}>
                    {(wallet?.customer_balance ?? 0) >= 200 ? 'Buy Pass for ₦200' : 'Insufficient Balance'}
                  </Text>
              }
            </Pressable>
          </View>
        )}

        {/* Referral Section — Customers only */}
        {profile?.role === 'Customer' && referral && (
          <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 14 }}>🎟️ Refer & Earn Free Delivery</Text>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <View style={{ flex: 1, backgroundColor: '#fff7ed', borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 26, fontWeight: '900', color: ORANGE }}>{referral.total_referred}</Text>
                <Text style={{ fontSize: 11, color: '#92400e', fontWeight: '600', marginTop: 2, textAlign: 'center' }}>Friends Referred</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#16a34a' }}>{referral.active_passes}</Text>
                <Text style={{ fontSize: 11, color: '#166534', fontWeight: '600', marginTop: 2, textAlign: 'center' }}>Free Delivery Passes</Text>
              </View>
            </View>

            {/* Referral code box */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Your Referral Code</Text>
            <View style={{ backgroundColor: '#fff7ed', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, borderWidth: 1.5, borderColor: '#fed7aa' }}>
              <Text style={{ flex: 1, fontSize: 22, fontWeight: '900', color: ORANGE, letterSpacing: 3 }}>
                {referral.referral_code}
              </Text>
              <Text style={{ fontSize: 11, color: '#92400e' }}>Tap Copy →</Text>
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={handleCopyLink}
                style={{ flex: 1, backgroundColor: copied ? '#f0fdf4' : '#f5f5f5', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: copied ? '#86efac' : '#e5e5e5' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: copied ? '#166534' : '#333' }}>
                  {copied ? '✓ Code Copied!' : '📋 Copy Code'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleWhatsApp}
                style={{ flex: 1, backgroundColor: '#dcfce7', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#86efac' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#166534' }}>💬 Share on WhatsApp</Text>
              </Pressable>
            </View>

            {/* Active pass cards */}
            {passes.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Your Active Passes
                </Text>
                {passes.map((pass) => {
                  const msLeft = new Date(pass.expires_at).getTime() - Date.now();
                  const hoursLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60)));
                  const urgent = hoursLeft <= 6;
                  return (
                    <View
                      key={pass.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        backgroundColor: urgent ? '#fff7ed' : '#f0fdf4',
                        borderRadius: 12, padding: 14, marginBottom: 8,
                        borderWidth: 1.5,
                        borderColor: urgent ? '#fed7aa' : '#bbf7d0',
                      }}
                    >
                      <Text style={{ fontSize: 26 }}>🎟️</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: urgent ? '#92400e' : '#166534' }}>
                          Free Delivery Pass
                        </Text>
                        <Text style={{ fontSize: 11, color: urgent ? '#b45309' : '#15803d', marginTop: 2 }}>
                          100% off delivery fee · 1 order
                        </Text>
                      </View>
                      <View style={{
                        backgroundColor: urgent ? '#fed7aa' : '#bbf7d0',
                        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: urgent ? '#92400e' : '#166534' }}>
                          {hoursLeft === 0 ? 'Expires soon!' : `${hoursLeft}h left`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* How it works hint */}
            <View style={{ marginTop: 14, backgroundColor: '#fff7ed', borderRadius: 10, padding: 12 }}>
              <Text style={{ fontSize: 11, color: '#92400e', lineHeight: 17 }}>
                <Text style={{ fontWeight: '800' }}>How it works: </Text>
                Share your code → friend signs up and enters your code → friend places their first order → you earn 1 Free Delivery Pass (valid 24 hours). No limit on referrals!
              </Text>
              <Text style={{ fontSize: 11, color: '#92400e', marginTop: 6, fontStyle: 'italic' }}>
                Passes expire 24 hours after earned.
              </Text>
            </View>
          </View>
        )}

        {/* Profile Info */}
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a' }}>Account Information</Text>
            <Pressable onPress={() => setEditing((v) => !v)}>
              <Text style={{ fontSize: 13, color: ORANGE, fontWeight: '700' }}>{editing ? 'Cancel' : 'Edit'}</Text>
            </Pressable>
          </View>

          <InfoRow label="Email" value={profile?.email || ''} />

          {editing ? (
            <>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#444', marginBottom: 6 }}>Full Name</Text>
                <TextInput
                  style={{ backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a1a' }}
                  value={editName} onChangeText={setEditName}
                />
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#444', marginBottom: 6 }}>Phone Number</Text>
                <TextInput
                  style={{ backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a1a' }}
                  value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad"
                />
              </View>
              <Pressable onPress={handleSave} disabled={saving}
                style={{ backgroundColor: ORANGE, padding: 13, borderRadius: 10, alignItems: 'center', opacity: saving ? 0.7 : 1 }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save Changes</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <InfoRow label="Full Name" value={profile?.name || '-'} />
              <InfoRow label="Phone" value={profile?.phone_number || '-'} />
              <InfoRow label="Role" value={profile?.role || '-'} isLast />
            </>
          )}
        </View>

        {/* Logout */}
        <Pressable onPress={handleLogout}
          style={{ marginHorizontal: 16, backgroundColor: '#fee2e2', borderRadius: 14, padding: 16, alignItems: 'center' }}>
          <Text style={{ color: '#dc2626', fontWeight: '800', fontSize: 15 }}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: '#f0f0f0' }}>
      <Text style={{ fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 14, color: '#1a1a1a', fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
