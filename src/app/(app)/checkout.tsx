import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '@/ctx';
import { getWallet, getDropoffLocations, placeOrder, getAppIsOpen, getDeliveryFee, getPackagingFee } from '@/db/api';
import { useCart } from '@/context/CartContext';
import type { Wallet, CampusDropoffLocation } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';

const ORANGE = '#F25C19';
const CREAM = '#FAF6F0';

export default function CheckoutScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { items, vendors, subtotal, clearCart, updateQuantity, removeItem } = useCart();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [locations, setLocations] = useState<CampusDropoffLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<CampusDropoffLocation | null>(null);
  const [locationDescription, setLocationDescription] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [error, setError] = useState('');
  const [appOpen, setAppOpen] = useState(true);
  // Per-vendor pack/plate opt-in: vendorId → boolean
  const [packVendors, setPackVendors] = useState<Record<string, boolean>>({});
  const [deliveryFee, setDeliveryFee] = useState(199);
  const [packagingFeeUnit, setPackagingFeeUnit] = useState(200);

  const packagingFee = vendors.filter((v) => packVendors[v.id]).length * packagingFeeUnit;
  const totalPrice = subtotal + deliveryFee + packagingFee;

  const loadData = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); return; }
    const [w, locs, open, dFee, pFee] = await Promise.all([
      getWallet(session.user.id),
      getDropoffLocations(),
      getAppIsOpen(),
      getDeliveryFee(),
      getPackagingFee(),
    ]);
    setWallet(w);
    setLocations(locs);
    setAppOpen(open);
    setDeliveryFee(dFee);
    setPackagingFeeUnit(pFee);
    setLoading(false);
  }, [session]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const togglePack = (vendorId: string) =>
    setPackVendors((prev) => ({ ...prev, [vendorId]: !prev[vendorId] }));

  const hasEnoughBalance = (wallet?.customer_balance ?? 0) >= totalPrice;
  const canPlaceOrder = appOpen && hasEnoughBalance && selectedLocation !== null && items.length > 0;

  const handlePlaceOrder = async () => {
    if (!appOpen) { setError('Fozdrop is currently closed. Please try again later.'); return; }
    if (!session?.user?.id || !selectedLocation) return;
    setPlacing(true); setError('');

    const vendorGroups = vendors.map((v) => {
      const vendorItems = items.filter((c) => c.vendor.id === v.id);
      const vendorSubtotal = vendorItems.reduce((s, c) => s + c.menu_item.price * c.quantity, 0);
      return {
        vendorId: v.id,
        subtotal: vendorSubtotal,
        packagingRequested: !!packVendors[v.id],
        items: vendorItems.map((c) => ({
          menuId: c.menu_item.id,
          itemName: c.menu_item.item_name,
          price: c.menu_item.price,
          quantity: c.quantity,
        })),
      };
    });

    const result = await placeOrder({
      customerId: session.user.id,
      vendorGroups,
      dropoffLocationId: selectedLocation.id,
      locationDescription,
      deliveryNotes,
      subtotal,
    });

    setPlacing(false);
    if (result.orderId) {
      clearCart();
      setShowSuccess(true);
    } else {
      setError(result.error ?? 'Failed to place order. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  if (items.length === 0 && !showSuccess) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 40 }}>🛒</Text>
        <Text style={{ fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginTop: 16 }}>Your cart is empty</Text>
        <Pressable onPress={() => router.back()}
          style={{ marginTop: 20, backgroundColor: ORANGE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Browse Vendors</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: CREAM }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{ backgroundColor: ORANGE, paddingTop: 54, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>‹</Text>
        </Pressable>
        <View>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Order Checkout</Text>
          {vendors.length > 1 && (
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 }}>
              {vendors.length} vendors · 1 delivery fee
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

        {/* App-closed banner */}
        {!appOpen && (
          <View style={{ backgroundColor: '#fee2e2', borderRadius: 14, padding: 20, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 36 }}>🔒</Text>
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#dc2626', textAlign: 'center' }}>We are currently closed</Text>
            <Text style={{ fontSize: 13, color: '#7f1d1d', textAlign: 'center', lineHeight: 20 }}>
              Fozdrop is not accepting orders right now. Please check back later!
            </Text>
          </View>
        )}

        {/* Per-vendor order sections */}
        {vendors.map((v, idx) => {
          const vendorItems = items.filter((c) => c.vendor.id === v.id);
          const vendorSubtotal = vendorItems.reduce((s, c) => s + c.menu_item.price * c.quantity, 0);
          const packOn = !!packVendors[v.id];
          return (
            <View key={v.id} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }}>
              {/* Vendor header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <View style={{ backgroundColor: ORANGE, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{idx + 1}</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a', flex: 1 }}>🏪 {v.name}</Text>
              </View>

              {/* Items */}
              {vendorItems.map((c) => (
                <View key={c.menu_item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 8 }}>
                  <Text style={{ fontSize: 13, color: '#555', flex: 1 }} numberOfLines={1}>{c.menu_item.item_name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pressable
                      onPress={() => updateQuantity(c.menu_item.id, c.quantity - 1)}
                      style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#555', lineHeight: 20 }}>−</Text>
                    </Pressable>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a', minWidth: 18, textAlign: 'center' }}>{c.quantity}</Text>
                    <Pressable
                      onPress={() => updateQuantity(c.menu_item.id, c.quantity + 1)}
                      style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff', lineHeight: 20 }}>+</Text>
                    </Pressable>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a1a', minWidth: 60, textAlign: 'right' }}>{formatNaira(c.menu_item.price * c.quantity)}</Text>
                  <Pressable
                    onPress={() => removeItem(c.menu_item.id)}
                    style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#dc2626', fontWeight: '900' }}>✕</Text>
                  </Pressable>
                </View>
              ))}

              {/* Vendor subtotal */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 }}>
                <Text style={{ fontSize: 13, color: '#888' }}>Vendor subtotal</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#555' }}>{formatNaira(vendorSubtotal)}</Text>
              </View>

              {/* Pack/plate toggle */}
              <Pressable
                onPress={() => togglePack(v.id)}
                style={{
                  marginTop: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: packOn ? '#fff7ed' : '#fafafa',
                  borderRadius: 12, padding: 12,
                  borderWidth: 1.5, borderColor: packOn ? '#fed7aa' : '#e5e5e5',
                }}
              >
                <View style={{
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: packOn ? ORANGE : '#e5e5e5',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>{packOn ? '✓' : ''}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: packOn ? '#92400e' : '#444' }}>
                    🥡 Add pack / plate (+{formatNaira(packagingFeeUnit)})
                  </Text>
                  <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {packOn ? 'Pack fee added for this vendor' : 'Tap to add packaging for this vendor\'s items'}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}

        {/* Price summary */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginBottom: 10 }}>Price Summary</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
            <Text style={{ fontSize: 13, color: '#888' }}>Items subtotal</Text>
            <Text style={{ fontSize: 13, color: '#555' }}>{formatNaira(subtotal)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
            <Text style={{ fontSize: 13, color: '#888' }}>
              Delivery fee{vendors.length > 1 ? ' (shared across vendors)' : ''}
            </Text>
            <Text style={{ fontSize: 13, color: '#555' }}>{formatNaira(deliveryFee)}</Text>
          </View>
          {packagingFee > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
              <Text style={{ fontSize: 13, color: '#888' }}>
                Pack / plate ({vendors.filter((v) => packVendors[v.id]).length}×)
              </Text>
              <Text style={{ fontSize: 13, color: '#555' }}>{formatNaira(packagingFee)}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 2, borderTopColor: '#f0f0f0', marginTop: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a' }}>Total</Text>
            <Text style={{ fontSize: 16, fontWeight: '900', color: ORANGE }}>{formatNaira(totalPrice)}</Text>
          </View>
        </View>

        {/* Wallet Balance */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 }}>
          <View>
            <Text style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Wallet Balance</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: hasEnoughBalance ? '#16a34a' : '#dc2626' }}>
              {formatNaira(wallet?.customer_balance ?? 0)}
            </Text>
          </View>
          {!hasEnoughBalance && (
            <Pressable onPress={() => setShowTopUpModal(true)}
              style={{ backgroundColor: ORANGE, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Top Up</Text>
            </Pressable>
          )}
        </View>

        {/* Location Selection */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 }}>📍 Dropoff Location *</Text>
          <Pressable onPress={() => setShowLocationPicker(true)}
            style={{ borderWidth: 1.5, borderColor: selectedLocation ? ORANGE : '#ddd', borderRadius: 10,
              padding: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: selectedLocation ? '#1a1a1a' : '#aaa', flex: 1 }}>
              {selectedLocation?.location_name || 'Select a campus dropoff location'}
            </Text>
            <Text style={{ color: ORANGE }}>›</Text>
          </Pressable>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginTop: 12, marginBottom: 6 }}>
            Location Description
          </Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 13, color: '#1a1a1a', height: 72, textAlignVertical: 'top' }}
            placeholder="e.g. I'm at the second floor, room 204"
            value={locationDescription}
            onChangeText={setLocationDescription}
            multiline
          />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#444', marginTop: 12, marginBottom: 6 }}>
            Delivery Notes (optional)
          </Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 13, color: '#1a1a1a', height: 72, textAlignVertical: 'top' }}
            placeholder="e.g. Meet me at the porter's lodge"
            value={deliveryNotes}
            onChangeText={setDeliveryNotes}
            multiline
          />
        </View>

        {error ? (
          <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 8 }}>
            <Text style={{ color: '#dc2626', fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}

        {!hasEnoughBalance && (
          <View style={{ backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', padding: 14, borderRadius: 12 }}>
            <Text style={{ fontSize: 13, color: '#9a3412', fontWeight: '700' }}>⚠️ Insufficient Balance</Text>
            <Text style={{ fontSize: 12, color: '#9a3412', marginTop: 4 }}>
              You need {formatNaira(totalPrice - (wallet?.customer_balance ?? 0))} more. Please top up your wallet.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Place Order Button */}
      {canPlaceOrder ? (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: CREAM }}>
          <Pressable onPress={handlePlaceOrder} disabled={placing}
            style={{ backgroundColor: ORANGE, padding: 18, borderRadius: 14, alignItems: 'center', opacity: placing ? 0.7 : 1, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 }}>
            {placing ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Place Order • {formatNaira(totalPrice)}</Text>
            )}
          </Pressable>
        </View>
      ) : !hasEnoughBalance ? null : (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: CREAM }}>
          <View style={{ backgroundColor: '#e5e5e5', padding: 18, borderRadius: 14, alignItems: 'center' }}>
            <Text style={{ color: '#999', fontWeight: '700', fontSize: 15 }}>Select a dropoff location to continue</Text>
          </View>
        </View>
      )}

      {/* Location Picker Modal */}
      <Modal visible={showLocationPicker} transparent animationType="slide" onRequestClose={() => setShowLocationPicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowLocationPicker(false)} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%' }}>
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#e5e5e5', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#1a1a1a' }}>Select Dropoff Location</Text>
          </View>
          <ScrollView>
            {locations.map((loc) => (
              <Pressable key={loc.id}
                onPress={() => { setSelectedLocation(loc); setShowLocationPicker(false); }}
                style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: selectedLocation?.id === loc.id ? ORANGE : '#ddd' }} />
                <Text style={{ fontSize: 14, color: '#1a1a1a', fontWeight: selectedLocation?.id === loc.id ? '700' : '400' }}>
                  {loc.location_name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Top Up Redirect Modal */}
      <Modal visible={showTopUpModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%' }}>
            <Text style={{ fontSize: 24, textAlign: 'center' }}>💳</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', marginTop: 10 }}>Top Up Your Wallet</Text>
            <Text style={{ fontSize: 13, color: '#555', textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 20 }}>
              Your balance is insufficient. Go to the Wallet tab to top up and come back to complete your order.
            </Text>
            <Pressable
              onPress={() => { setShowTopUpModal(false); router.push('/(app)/(tabs)/wallet'); }}
              style={{ backgroundColor: ORANGE, padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Go to Wallet</Text>
            </Pressable>
            <Pressable onPress={() => setShowTopUpModal(false)}
              style={{ backgroundColor: '#f0f0f0', padding: 14, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: '#555' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', alignItems: 'center' }}>
            <Text style={{ fontSize: 56 }}>🎉</Text>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#1a1a1a', marginTop: 16 }}>
              {vendors.length > 1 ? `${vendors.length} Orders Placed!` : 'Order Placed!'}
            </Text>
            <Text style={{ fontSize: 14, color: '#555', textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
              {vendors.length > 1
                ? `Your orders from ${vendors.map((v) => v.name).join(' & ')} are on their way!`
                : "Your order has been sent to the vendor. You'll receive it at your chosen campus location."}
            </Text>
            <Pressable
              onPress={() => { setShowSuccess(false); router.push('/(app)/(tabs)/orders'); }}
              style={{ backgroundColor: ORANGE, padding: 16, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 24 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Track Orders</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
