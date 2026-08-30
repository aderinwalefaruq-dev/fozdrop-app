import {
  View, Text, FlatList, Pressable, ActivityIndicator, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '@/ctx';
import { getVendorById, getMenuByVendor, getActiveMenuByVendor, toggleMenuItemActive, getSectionsByVendor } from '@/db/api';
import { useCart } from '@/context/CartContext';
import type { Vendor, MenuItem, MenuSection } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';

const ORANGE = '#F25C19';
const CREAM = '#FAF6F0';

export default function VendorStoreView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const {
    plates, activePlateId, setActivePlate, getOrCreateActivePlateForVendor,
    addPlate, removePlate, addItemToPlate, totalItems,
  } = useCart();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [activeSection, setActiveSection] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id || !session?.user?.id) { setLoading(false); return; }
    const v = await getVendorById(id);
    setVendor(v);
    const isOwner = v?.owner_id === session.user.id;
    const [menu, secs] = await Promise.all([
      isOwner ? getMenuByVendor(id) : getActiveMenuByVendor(id),
      getSectionsByVendor(id),
    ]);
    setMenuItems(menu);
    setSections(secs);
    setLoading(false);
  }, [id, session]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const isVendorOwner = vendor?.owner_id === session?.user?.id;

  // This vendor's plates, in creation order (Plate A, Plate B, ...)
  const vendorPlates = vendor ? plates.filter((p) => p.vendor.id === vendor.id) : [];
  const activePlate = vendorPlates.find((p) => p.id === activePlateId) ?? vendorPlates[0] ?? null;

  const handleAddToCart = (item: MenuItem) => {
    if (!vendor) return;
    const plateId = getOrCreateActivePlateForVendor(vendor);
    addItemToPlate(plateId, item);
  };

  const handleToggleActive = async (item: MenuItem) => {
    await toggleMenuItemActive(item.id, !item.is_active);
    loadData();
  };

  // Group items by section for display
  const unsectionedItems = menuItems.filter((m) => !m.section_id);

  // Filter by active section tab
  const visibleItems = activeSection === 'all'
    ? menuItems
    : activeSection === '__none__'
      ? unsectionedItems
      : menuItems.filter((m) => m.section_id === activeSection);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  const hasSections = sections.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <StatusBar style="light" />
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            {/* Vendor Hero */}
            <View style={{ position: 'relative' }}>
              <Image
                source={{ uri: vendor?.image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800' }}
                style={{ width: '100%', height: 220 }}
                contentFit="cover"
              />
              <Pressable
                onPress={() => router.back()}
                style={{ position: 'absolute', top: 50, left: 16, width: 38, height: 38, borderRadius: 19,
                  backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>‹</Text>
              </Pressable>
            </View>

            {/* Vendor Info */}
            <View style={{ backgroundColor: '#fff', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#1a1a1a', flex: 1 }}>{vendor?.name}</Text>
                <View style={{ backgroundColor: vendor?.status === 'Open' ? '#dcfce7' : '#fee2e2', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: vendor?.status === 'Open' ? '#16a34a' : '#dc2626' }}>
                    {vendor?.status}
                  </Text>
                </View>
              </View>
            </View>

            {/* Plates bar — lets a customer build more than one independent
                basket from this vendor (e.g. Plate A for themselves, Plate B
                for a friend), each with its own combination of items. Only
                shown once a plate exists, so single-plate ordering (the
                common case) stays frictionless — the first "+" on any item
                silently creates "Plate A". */}
            {!isVendorOwner && vendor && vendorPlates.length > 0 && (
              <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingVertical: 10 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' }}>
                  {vendorPlates.map((plate) => {
                    const isActive = plate.id === activePlate?.id;
                    const itemCount = plate.items.reduce((s, i) => s + i.quantity, 0);
                    return (
                      <Pressable
                        key={plate.id}
                        onPress={() => setActivePlate(plate.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                          borderWidth: 1.5, borderColor: isActive ? ORANGE : '#e5e5e5', backgroundColor: isActive ? ORANGE : '#fff' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: isActive ? '#fff' : '#1a1a1a' }}>
                          {plate.label}{itemCount > 0 ? ` (${itemCount})` : ''}
                        </Text>
                        {vendorPlates.length > 1 && (
                          <Pressable hitSlop={8} onPress={() => removePlate(plate.id)}>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: isActive ? '#fff' : '#aaa' }}>✕</Text>
                          </Pressable>
                        )}
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => addPlate(vendor)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: ORANGE, borderStyle: 'dashed' }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: ORANGE }}>+ Add Plate</Text>
                  </Pressable>
                </ScrollView>
                <Text style={{ fontSize: 11, color: '#999', paddingHorizontal: 16, marginTop: 6 }}>
                  Adding items goes into <Text style={{ fontWeight: '800', color: '#555' }}>{activePlate?.label}</Text> — tap another plate to switch, or add a new one for a second, separately-packed order.
                </Text>
              </View>
            )}

            {/* Section tabs */}
            {hasSections && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' }}>
                <SectionTab label="All" active={activeSection === 'all'} onPress={() => setActiveSection('all')} />
                {sections.map((s) => (
                  <SectionTab key={s.id} label={s.name} active={activeSection === s.id} onPress={() => setActiveSection(s.id)} />
                ))}
                {unsectionedItems.length > 0 && (
                  <SectionTab label="Other" active={activeSection === '__none__'} onPress={() => setActiveSection('__none__')} />
                )}
              </ScrollView>
            )}

            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a', padding: 16, paddingBottom: 8 }}>
              {activeSection === 'all' ? 'Menu Items' : (sections.find((s) => s.id === activeSection)?.name ?? 'Other')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 36 }}>🍽️</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#555', marginTop: 10 }}>No menu items available</Text>
          </View>
        }
        renderItem={({ item }) => (
          <MenuItemRow
            item={item}
            isVendorOwner={isVendorOwner}
            cartQty={activePlate?.items.find((i) => i.menuItemId === item.id)?.quantity || 0}
            onAdd={() => handleAddToCart(item)}
            onToggleActive={() => handleToggleActive(item)}
          />
        )}
        ListFooterComponent={
          totalItems > 0 && !isVendorOwner ? (
            <Pressable
              onPress={() => router.push('/(app)/checkout')}
              style={{ margin: 16, marginTop: 12, backgroundColor: ORANGE,
                borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 16 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{totalItems}</Text>
              </View>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>View Cart</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>›</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

function SectionTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}
      style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
        borderColor: active ? ORANGE : '#e5e5e5', backgroundColor: active ? ORANGE : '#fff' }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : '#555' }}>{label}</Text>
    </Pressable>
  );
}

function MenuItemRow({
  item, isVendorOwner, cartQty, onAdd, onToggleActive,
}: {
  item: MenuItem;
  isVendorOwner: boolean;
  cartQty: number;
  onAdd: () => void;
  onToggleActive: () => void;
}) {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 7, backgroundColor: '#fff', borderRadius: 12,
      overflow: 'hidden', opacity: item.is_active ? 1 : 0.55, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Left: name + meta */}
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a', letterSpacing: 0.1 }}
            numberOfLines={1}>{item.item_name}</Text>
          {item.description ? (
            <Text style={{ fontSize: 11, color: '#999', fontStyle: 'italic', lineHeight: 15 }} numberOfLines={1}>{item.description}</Text>
          ) : null}
          {item.prep_time_mins ? (
            <Text style={{ fontSize: 10, color: '#bbb', marginTop: 1 }}>⏱ ~{item.prep_time_mins} min</Text>
          ) : null}
        </View>
        {/* Right: price + action */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: ORANGE, letterSpacing: 0.2 }}>{formatNaira(item.price)}</Text>
          {isVendorOwner ? (
            <Pressable onPress={onToggleActive}
              style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                backgroundColor: item.is_active ? '#dcfce7' : '#f0f0f0' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: item.is_active ? '#16a34a' : '#888' }}>
                {item.is_active ? '● On' : '○ Off'}
              </Text>
            </Pressable>
          ) : (
            item.is_active ? (
              <Pressable onPress={onAdd}
                style={{ backgroundColor: cartQty > 0 ? ORANGE : '#fff5f0', width: 28, height: 28, borderRadius: 14,
                  alignItems: 'center', justifyContent: 'center', borderWidth: cartQty > 0 ? 0 : 1, borderColor: ORANGE }}>
                <Text style={{ fontSize: cartQty > 0 ? 12 : 17, fontWeight: '900', color: cartQty > 0 ? '#fff' : ORANGE }}>
                  {cartQty > 0 ? cartQty : '+'}
                </Text>
              </Pressable>
            ) : (
              <Text style={{ fontSize: 10, color: '#dc2626', fontWeight: '600' }}>Unavail.</Text>
            )
          )}
        </View>
      </View>
    </View>
  );
}
