/**
 * Admin — Full Menu Editor
 * Edit dish title / price / description, toggle availability,
 * add new items, delete items, manage sections — for any vendor.
 */
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Switch, Modal, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Plus, Trash2, Check, X } from 'lucide-react-native';

import {
  getMenuByVendor, getSectionsByVendor, addMenuSection,
  adminUpsertMenuItem, adminDeleteMenuItem,
} from '@/db/api';
import type { MenuItem, MenuSection } from '@/types/types';

const ORANGE = '#F25C19';
const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';

type EditState = Partial<MenuItem> & { vendor_id: string; item_name: string; price: number };

const EMPTY_EDIT = (vendorId: string): EditState => ({
  vendor_id: vendorId, item_name: '', price: 0, description: '', is_active: true, section_id: null,
});

export default function AdminMenuEditor() {
  const { vendorId, vendorName } = useLocalSearchParams<{ vendorId: string; vendorName: string }>();
  const router = useRouter();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editItem, setEditItem] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [addingSection, setAddingSection] = useState(false);

  const load = useCallback(async () => {
    if (!vendorId) { setLoading(false); return; }
    const [m, s] = await Promise.all([getMenuByVendor(vendorId), getSectionsByVendor(vendorId)]);
    setItems(m);
    setSections(s);
    setLoading(false);
  }, [vendorId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const saveItem = async () => {
    if (!editItem || !editItem.item_name.trim() || editItem.price < 0) return;
    setSaving(true);
    await adminUpsertMenuItem({ ...editItem, vendor_id: vendorId ?? '' });
    await load();
    setSaving(false);
    setEditItem(null);
  };

  const toggleActive = async (item: MenuItem) => {
    await adminUpsertMenuItem({ ...item, is_active: !item.is_active });
    setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, is_active: !x.is_active } : x));
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await adminDeleteMenuItem(deleteTarget.id);
    setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleAddSection = async () => {
    if (!newSectionName.trim() || !vendorId) return;
    setAddingSection(true);
    await addMenuSection(vendorId, newSectionName.trim(), sections.length);
    await load();
    setNewSectionName('');
    setAddingSection(false);
  };

  const sectionName = (id: string | null) =>
    sections.find((s) => s.id === id)?.name ?? 'Uncategorised';

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const key = item.section_id ?? '__none__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#94a3b8" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Menu Editor</Text>
          <Text style={{ color: '#64748b', fontSize: 11 }}>{vendorName}</Text>
        </View>
        <Pressable
          onPress={() => setEditItem(EMPTY_EDIT(vendorId ?? ''))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ORANGE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Plus size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Add Item</Text>
        </Pressable>
      </View>

      {loading
        ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={ORANGE} /></View>
        : (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
          >
            {/* Add section */}
            <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 20 }}>
              <TextInput
                value={newSectionName}
                onChangeText={setNewSectionName}
                placeholder="New section name…"
                placeholderTextColor="#475569"
                style={{ flex: 1, backgroundColor: CARD, color: '#fff', borderRadius: 10, padding: 11, fontSize: 13, borderWidth: 1, borderColor: BORDER }}
              />
              <Pressable
                onPress={handleAddSection}
                style={{ backgroundColor: '#334155', borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}
              >
                {addingSection ? <ActivityIndicator color={ORANGE} size="small" /> : <Plus size={18} color={ORANGE} />}
              </Pressable>
            </View>

            {Object.entries(grouped).map(([sectionId, sectionItems]) => (
              <View key={sectionId} style={{ marginBottom: 20 }}>
                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 16, marginBottom: 8 }}>
                  {sectionId === '__none__' ? 'Uncategorised' : sectionName(sectionId)}
                </Text>
                {sectionItems.map((item) => (
                  <View key={item.id} style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: CARD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{item.item_name}</Text>
                        {!!item.description && (
                          <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }} numberOfLines={2}>{item.description}</Text>
                        )}
                        <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 13, marginTop: 4 }}>₦{Number(item.price).toLocaleString()}</Text>
                      </View>
                      <View style={{ alignItems: 'center', gap: 8 }}>
                        <Switch
                          value={item.is_active}
                          onValueChange={() => toggleActive(item)}
                          trackColor={{ false: '#334155', true: '#22c55e' }}
                          thumbColor="#fff"
                        />
                        <Text style={{ color: item.is_active ? '#22c55e' : '#64748b', fontSize: 10 }}>
                          {item.is_active ? 'In Stock' : 'Out'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER }}>
                      <Pressable
                        onPress={() => setEditItem({ ...item })}
                        style={{ flex: 1, backgroundColor: '#334155', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
                      >
                        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700' }}>Edit</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setDeleteTarget(item)}
                        style={{ backgroundColor: '#45090922', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' }}
                      >
                        <Trash2 size={14} color="#f87171" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

      {/* Edit / Add Item Modal */}
      <Modal visible={!!editItem} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1, borderColor: BORDER }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                {editItem?.id ? 'Edit Item' : 'New Menu Item'}
              </Text>
              <Pressable onPress={() => setEditItem(null)}><X size={20} color="#64748b" /></Pressable>
            </View>

            {[
              { label: 'Item Name', key: 'item_name', placeholder: 'e.g. Jollof Rice', numeric: false },
              { label: 'Price (₦)', key: 'price', placeholder: '500', numeric: true },
              { label: 'Description', key: 'description', placeholder: 'Optional description…', numeric: false },
            ].map(({ label, key, placeholder, numeric }) => (
              <View key={key} style={{ marginBottom: 12 }}>
                <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 5 }}>{label}</Text>
                <TextInput
                  value={editItem ? String((editItem as Record<string, unknown>)[key] ?? '') : ''}
                  onChangeText={(v) => setEditItem((prev) => prev ? { ...prev, [key]: numeric ? Number(v) || 0 : v } : prev)}
                  placeholder={placeholder}
                  placeholderTextColor="#475569"
                  keyboardType={numeric ? 'numeric' : 'default'}
                  style={{ backgroundColor: BG, color: '#fff', borderRadius: 10, padding: 12, fontSize: 13, borderWidth: 1, borderColor: BORDER }}
                />
              </View>
            ))}

            {/* Section picker */}
            <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 5 }}>Section</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {[{ id: null, name: 'None' }, ...sections].map((s) => (
                <Pressable
                  key={s.id ?? 'none'}
                  onPress={() => setEditItem((prev) => prev ? { ...prev, section_id: s.id } : prev)}
                  style={{ backgroundColor: editItem?.section_id === s.id ? ORANGE : '#334155', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 }}
                >
                  <Text style={{ color: editItem?.section_id === s.id ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: '700' }}>{s.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* In stock toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ color: '#94a3b8', fontSize: 13 }}>In Stock</Text>
              <Switch
                value={editItem?.is_active ?? true}
                onValueChange={(v) => setEditItem((prev) => prev ? { ...prev, is_active: v } : prev)}
                trackColor={{ false: '#334155', true: '#22c55e' }}
                thumbColor="#fff"
              />
            </View>

            <Pressable
              onPress={saveItem}
              style={{ backgroundColor: ORANGE, borderRadius: 12, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Check size={16} color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Save Item</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm */}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 24, width: '100%', borderWidth: 1, borderColor: '#ef4444' }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 8 }}>Delete Menu Item?</Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
              Remove <Text style={{ color: '#fca5a5', fontWeight: '700' }}>{deleteTarget?.item_name}</Text> from the menu?
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setDeleteTarget(null)} style={{ flex: 1, backgroundColor: '#334155', borderRadius: 12, padding: 13, alignItems: 'center' }}>
                <Text style={{ color: '#94a3b8', fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 12, padding: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Trash2 size={14} color="#fff" />}
                <Text style={{ color: '#fff', fontWeight: '800' }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
