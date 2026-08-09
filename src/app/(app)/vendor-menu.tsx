import {
  View, Text, FlatList, Pressable, TextInput,
  ActivityIndicator, Modal, KeyboardAvoidingView, ScrollView, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { fetch } from 'expo/fetch';
import { useSession } from '@/ctx';
import {
  getVendorByOwnerId, getMenuByVendor, addMenuItem,
  updateMenuItem, deleteMenuItem, toggleMenuItemActive,
  updateVendorStatus, createVendor, updateVendor,
  getSectionsByVendor, addMenuSection, deleteMenuSection,
} from '@/db/api';
import { supabase } from '@/client/supabase';
import type { Vendor, MenuItem, MenuSection } from '@/types/types';
import { formatNaira } from '@/lib/utils/format';

const ORANGE = '#F25C19';
const CREAM = '#FAF6F0';

const COMMON_SECTIONS = [
  'Standalone Pack', 'Noodles', 'Drink', 'Swallow', 'Water',
  'Yam, Potatoes & Plantain', 'Shawarma', 'Yam', 'Yam & Egg Sauce',
  'SAUCE', 'Yam & Egg', 'Snacks & Small Chops',
];

type FormState = {
  item_name: string;
  description: string;
  price: string;
  is_active: boolean;
  section_id: string;
  prep_time_mins: string;
};

const BLANK_FORM: FormState = {
  item_name: '', description: '', price: '',
  is_active: true, section_id: '', prep_time_mins: '',
};

export default function VendorMenuScreen() {
  const { session } = useSession();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<MenuItem | null>(null);
  const [toggling, setToggling] = useState(false);

  // Section management
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [customSectionName, setCustomSectionName] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [addingSection, setAddingSection] = useState(false);

  // Store setup state
  const [storeName, setStoreName] = useState('');
  const [creatingStore, setCreatingStore] = useState(false);
  const [storeError, setStoreError] = useState('');

  // Vendor cover photo upload
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState('');

  const loadData = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); return; }
    const v = await getVendorByOwnerId(session.user.id);
    setVendor(v);
    if (v) {
      const [m, s] = await Promise.all([getMenuByVendor(v.id), getSectionsByVendor(v.id)]);
      setItems(m);
      setSections(s);
    }
    setLoading(false);
  }, [session]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const openAdd = () => {
    setEditingItem(null);
    setForm(BLANK_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({
      item_name: item.item_name,
      description: item.description || '',
      price: String(item.price),
      is_active: item.is_active,
      section_id: item.section_id || '',
      prep_time_mins: item.prep_time_mins ? String(item.prep_time_mins) : '',
    });
    setFormError('');
    setShowForm(true);
  };

  const pickCoverPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setCoverError('Photo library access is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9],
      // quality: 0.6 keeps most images well under 5 MB even on high-res cameras
      quality: 0.6,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingCover(true); setCoverError('');
    try {
      // Use expo/fetch so content:// URIs work correctly on Android
      const { fetch: expoFetch } = await import('expo/fetch');
      const res = await expoFetch(asset.uri);
      if (!res.ok) throw new Error(`Failed to read image: ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();

      // Guard: reject if still over 5 MB (very rare at quality 0.6)
      const MAX_BYTES = 5 * 1024 * 1024;
      if (arrayBuffer.byteLength > MAX_BYTES) {
        setCoverError('Image is too large. Please choose a smaller photo (max 5 MB).');
        setUploadingCover(false);
        return;
      }

      const fileName = `vendor-covers/${vendor?.id}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('menu-images')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (error || !data) {
        setCoverError(`Upload failed: ${error?.message ?? 'Unknown error'}. Try again.`);
      } else {
        const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(data.path);
        if (vendor) await updateVendor(vendor.id, { image: urlData.publicUrl });
        loadData();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setCoverError(`Upload failed: ${msg}. Try again.`);
    }
    setUploadingCover(false);
  };

  const handleSave = async () => {
    if (!vendor) return;
    const name = form.item_name.trim();
    const price = parseFloat(form.price);
    if (!name) { setFormError('Item name is required'); return; }
    if (!price || price <= 0) { setFormError('Enter a valid price'); return; }
    setSaving(true); setFormError('');
    const payload = {
      vendor_id: vendor.id,
      item_name: name,
      description: form.description.trim(),
      price,
      image: '',
      is_active: form.is_active,
      section_id: form.section_id || null,
      prep_time_mins: form.prep_time_mins ? parseInt(form.prep_time_mins, 10) : null,
    };
    if (editingItem) { await updateMenuItem(editingItem.id, payload); }
    else { await addMenuItem(payload); }
    setSaving(false);
    setShowForm(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteMenuItem(confirmDelete.id);
    setConfirmDelete(null);
    loadData();
  };

  const handleToggle = async (item: MenuItem) => {
    setToggling(true);
    await toggleMenuItemActive(item.id, !item.is_active);
    setToggling(false);
    loadData();
  };

  const handleShopToggle = async () => {
    if (!vendor) return;
    await updateVendorStatus(vendor.id, vendor.status === 'Open' ? 'Closed' : 'Open');
    loadData();
  };

  const handleCreateStore = async () => {
    if (!storeName.trim()) { setStoreError('Please enter your store name'); return; }
    if (!session?.user?.id) return;
    setCreatingStore(true); setStoreError('');
    const newVendor = await createVendor(session.user.id, storeName.trim());
    setCreatingStore(false);
    if (!newVendor) { setStoreError('Failed to create store. Please try again.'); return; }
    setVendor(newVendor);
    setItems([]);
  };

  const handleAddSection = async (name: string) => {
    if (!vendor || !name.trim()) return;
    if (sections.find((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
      setSectionError('This section already exists'); return;
    }
    setAddingSection(true); setSectionError('');
    await addMenuSection(vendor.id, name.trim(), sections.length);
    setAddingSection(false);
    setCustomSectionName('');
    loadData();
  };

  const handleDeleteSection = async (section: MenuSection) => {
    await deleteMenuSection(section.id);
    loadData();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  if (!vendor) {
    return (
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: CREAM }}>
        <StatusBar style="dark" />
        <View style={{ backgroundColor: ORANGE, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>Get Started</Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 2 }}>Set Up Your Store</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ fontSize: 56 }}>🏪</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginTop: 14, textAlign: 'center' }}>Create Your Store on Fozdrop</Text>
            <Text style={{ fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>Enter your store name below to get started. You can add your menu items right after.</Text>
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 8 }}>Store / Restaurant Name *</Text>
            <TextInput
              style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: storeName ? ORANGE : '#ddd', borderRadius: 12, padding: 14, fontSize: 16, color: '#1a1a1a' }}
              placeholder="e.g. Mama Ngozi Kitchen" value={storeName} onChangeText={setStoreName}
              autoCapitalize="words" autoCorrect={false} returnKeyType="done" onSubmitEditing={handleCreateStore}
            />
          </View>
          {storeError ? <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 10 }}><Text style={{ color: '#dc2626', fontSize: 13 }}>{storeError}</Text></View> : null}
          <Pressable onPress={handleCreateStore} disabled={creatingStore}
            style={{ backgroundColor: ORANGE, padding: 16, borderRadius: 12, alignItems: 'center', opacity: creatingStore ? 0.7 : 1 }}>
            {creatingStore ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Create My Store</Text>}
          </Pressable>
          <Text style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>You can update your store name and add a photo from your Profile.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <StatusBar style="dark" />
      <View style={{ backgroundColor: ORANGE, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>My Menu</Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 }}>{vendor.name}</Text>
          </View>
          <Pressable onPress={handleShopToggle}
            style={{ backgroundColor: vendor.status === 'Open' ? '#dcfce7' : '#fee2e2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
            <Text style={{ fontWeight: '800', fontSize: 12, color: vendor.status === 'Open' ? '#16a34a' : '#dc2626' }}>
              {vendor.status === 'Open' ? '🟢 Open' : '🔴 Closed'}
            </Text>
          </Pressable>
        </View>

        {/* Cover photo row */}
        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 72, height: 54, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)' }}>
            {vendor.image ? (
              <Image source={{ uri: vendor.image }} style={{ width: 72, height: 54 }} contentFit="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>🏪</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Pressable onPress={pickCoverPhoto} disabled={uploadingCover}
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                alignSelf: 'flex-start', opacity: uploadingCover ? 0.6 : 1 }}>
              {uploadingCover
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    {vendor.image ? '📷 Change Cover Photo' : '📷 Add Cover Photo'}
                  </Text>
              }
            </Pressable>
            {coverError ? <Text style={{ color: '#fecaca', fontSize: 11, marginTop: 4 }}>{coverError}</Text> : null}
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 }}>
              Shown to customers on your store page
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a' }}>
                {items.length} Menu Item{items.length !== 1 ? 's' : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => { setSectionError(''); setCustomSectionName(''); setShowSectionModal(true); }}
                  style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: ORANGE, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 }}>
                  <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 13 }}>📂 Sections</Text>
                </Pressable>
                <Pressable onPress={openAdd}
                  style={{ backgroundColor: ORANGE, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>+ Add Item</Text>
                </Pressable>
              </View>
            </View>
            {sections.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: 'row' }}>
                {sections.map((s) => (
                  <View key={s.id} style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#e5e5e5' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#555' }}>{s.name}</Text>
                    <Pressable onPress={() => handleDeleteSection(s)}>
                      <Text style={{ fontSize: 12, color: '#dc2626', fontWeight: '900' }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Text style={{ fontSize: 44 }}>🍽️</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginTop: 14 }}>No menu items yet</Text>
            <Text style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Tap "Add Item" to list your first dish</Text>
          </View>
        }
        renderItem={({ item }) => (
          <MenuItemCard
            item={item}
            sectionName={sections.find((s) => s.id === item.section_id)?.name}
            onEdit={() => openEdit(item)}
            onDelete={() => setConfirmDelete(item)}
            onToggle={() => handleToggle(item)}
            toggling={toggling}
          />
        )}
      />

      {/* Add / Edit Form Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowForm(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#e5e5e5', borderRadius: 2, alignSelf: 'center', marginTop: 12 }} />
            <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a1a' }}>
                {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
              </Text>

              <FormField label="Item Name *" value={form.item_name} onChange={(v) => setForm((f) => ({ ...f, item_name: v }))} placeholder="e.g. Jollof Rice & Chicken" />
              <FormField label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Short description (optional)" multiline />
              <FormField label="Price (₦) *" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} placeholder="e.g. 1500" keyboardType="numeric" />
              <FormField label="Prep Time (minutes)" value={form.prep_time_mins} onChange={(v) => setForm((f) => ({ ...f, prep_time_mins: v }))} placeholder="e.g. 15" keyboardType="numeric" />

              {/* Section picker */}
              {sections.length > 0 && (
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#444', marginBottom: 8 }}>Menu Section</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: 'row' }}>
                    <Pressable onPress={() => setForm((f) => ({ ...f, section_id: '' }))}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                        borderColor: !form.section_id ? ORANGE : '#e5e5e5', backgroundColor: !form.section_id ? '#fff5f0' : '#f9f9f9' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: !form.section_id ? ORANGE : '#888' }}>No section</Text>
                    </Pressable>
                    {sections.map((s) => (
                      <Pressable key={s.id} onPress={() => setForm((f) => ({ ...f, section_id: s.id }))}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                          borderColor: form.section_id === s.id ? ORANGE : '#e5e5e5', backgroundColor: form.section_id === s.id ? '#fff5f0' : '#f9f9f9' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: form.section_id === s.id ? ORANGE : '#555' }}>{s.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 14, borderRadius: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a' }}>Available to order</Text>
                <Switch value={form.is_active} onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                  trackColor={{ false: '#e5e5e5', true: ORANGE }} thumbColor="#fff" />
              </View>

              {formError ? <Text style={{ color: '#dc2626', fontSize: 13 }}>{formError}</Text> : null}

              <Pressable onPress={handleSave} disabled={saving}
                style={{ backgroundColor: ORANGE, padding: 16, borderRadius: 12, alignItems: 'center', opacity: saving ? 0.7 : 1 }}>
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{editingItem ? 'Save Changes' : 'Add to Menu'}</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Section Management Modal */}
      <Modal visible={showSectionModal} transparent animationType="slide" onRequestClose={() => setShowSectionModal(false)}>
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowSectionModal(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#e5e5e5', borderRadius: 2, alignSelf: 'center', marginTop: 12 }} />
            <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a1a' }}>Add a menu section</Text>
              <Text style={{ fontSize: 13, color: '#888', lineHeight: 20, marginTop: -8 }}>
                Sections group your menu so customers can find things — like Rice, Drinks or Snacks.
              </Text>

              {/* Quick-select chips */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#444', marginBottom: 10 }}>Tap a common one:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COMMON_SECTIONS.map((name) => {
                    const exists = sections.some((s) => s.name.toLowerCase() === name.toLowerCase());
                    return (
                      <Pressable key={name} onPress={() => !exists && handleAddSection(name)} disabled={exists || addingSection}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                          borderColor: exists ? '#e5e5e5' : ORANGE, backgroundColor: exists ? '#f5f5f5' : '#fff5f0',
                          opacity: exists ? 0.5 : 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: exists ? '#aaa' : ORANGE }}>
                          {exists ? '✓ ' : '+ '}{name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Custom section input */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#444', marginBottom: 8 }}>Custom section:</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: customSectionName ? ORANGE : '#ddd',
                      borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a1a' }}
                    placeholder="e.g. Rice, Drinks, Snacks"
                    value={customSectionName}
                    onChangeText={setCustomSectionName}
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={() => handleAddSection(customSectionName)}
                  />
                  <Pressable onPress={() => handleAddSection(customSectionName)} disabled={addingSection || !customSectionName.trim()}
                    style={{ backgroundColor: ORANGE, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                      opacity: !customSectionName.trim() ? 0.4 : 1 }}>
                    {addingSection ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Add</Text>}
                  </Pressable>
                </View>
                {sectionError ? <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{sectionError}</Text> : null}
              </View>

              {/* Existing sections */}
              {sections.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#444' }}>Your sections:</Text>
                  {sections.map((s) => (
                    <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: '#f9f9f9', borderRadius: 10, padding: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a' }}>{s.name}</Text>
                      <Pressable onPress={() => handleDeleteSection(s)}
                        style={{ backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 }}>
                        <Text style={{ fontSize: 12, color: '#dc2626', fontWeight: '700' }}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <Pressable onPress={() => setShowSectionModal(false)}
                style={{ backgroundColor: ORANGE, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Done</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 }}>Delete Item?</Text>
            <Text style={{ fontSize: 14, color: '#555', marginBottom: 24 }}>
              Remove <Text style={{ fontWeight: '700' }}>{confirmDelete?.item_name}</Text> from your menu? This cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: 13, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#555' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleDelete}
                style={{ flex: 1, padding: 13, borderRadius: 10, backgroundColor: '#dc2626', alignItems: 'center' }}>
                <Text style={{ fontWeight: '800', color: '#fff' }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MenuItemCard({
  item, sectionName, onEdit, onDelete, onToggle, toggling,
}: {
  item: MenuItem; sectionName?: string; onEdit: () => void; onDelete: () => void; onToggle: () => void; toggling: boolean;
}) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }}>
      {/* Content row */}
      <View style={{ paddingHorizontal: 12, paddingTop: 9, paddingBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a', letterSpacing: 0.1 }}>{item.item_name}</Text>
          {sectionName ? <Text style={{ fontSize: 10, color: ORANGE, fontWeight: '700', letterSpacing: 0.2 }}>📂 {sectionName}</Text> : null}
          {item.description ? <Text style={{ fontSize: 11, color: '#999', fontStyle: 'italic', lineHeight: 15 }} numberOfLines={1}>{item.description}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: ORANGE, letterSpacing: 0.2 }}>{formatNaira(item.price)}</Text>
          {item.prep_time_mins ? (
            <Text style={{ fontSize: 10, color: '#bbb' }}>⏱ {item.prep_time_mins} min</Text>
          ) : null}
        </View>
      </View>
      {/* Action row */}
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f5f5f5', alignItems: 'center',
        paddingHorizontal: 10, paddingVertical: 6, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 5 }}>
          <Switch value={item.is_active} onValueChange={onToggle} disabled={toggling}
            trackColor={{ false: '#e5e5e5', true: '#dcfce7' }} thumbColor={item.is_active ? '#16a34a' : '#aaa'}
            style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }} />
          <Text style={{ fontSize: 11, color: item.is_active ? '#16a34a' : '#aaa', fontWeight: '700' }}>
            {item.is_active ? 'Available' : 'Hidden'}
          </Text>
        </View>
        <Pressable onPress={onEdit} style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 7, backgroundColor: '#f0f0f0' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#333' }}>Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 7, backgroundColor: '#fee2e2' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626' }}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FormField({
  label, value, onChange, placeholder, keyboardType = 'default', multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric'; multiline?: boolean;
}) {
  return (
    <View>
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#444', marginBottom: 6 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a1a',
          minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? 'top' : 'center' }}
        value={value} onChangeText={onChange} placeholder={placeholder}
        keyboardType={keyboardType} multiline={multiline} autoCorrect={false}
      />
    </View>
  );
}

