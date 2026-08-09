/**
 * Admin — Vendor Management
 * View, edit, suspend/reopen, pause/unpause, delete any vendor.
 * Tap "Edit Menu" to navigate to the menu editor for that vendor.
 */
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Switch, RefreshControl, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Store, Trash2, Pencil, X, Check } from 'lucide-react-native';

import { getAdminVendors, adminUpdateVendor, adminDeleteVendor } from '@/db/api';
import type { Vendor } from '@/types/types';

const ORANGE = '#F25C19';
const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';

export default function AdminVendors() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const data = await getAdminVendors();
    setVendors(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const togglePause = async (v: Vendor) => {
    await adminUpdateVendor(v.id, { orders_paused: !v.orders_paused });
    setVendors((prev) => prev.map((x) => x.id === v.id ? { ...x, orders_paused: !x.orders_paused } : x));
  };

  const toggleSuspend = async (v: Vendor) => {
    const newStatus = v.status === 'Suspended' ? 'Open' : 'Suspended';
    await adminUpdateVendor(v.id, { status: newStatus });
    setVendors((prev) => prev.map((x) => x.id === v.id ? { ...x, status: newStatus } : x));
  };

  const saveEdit = async () => {
    if (!editTarget || !editName.trim()) return;
    setSaving(true);
    await adminUpdateVendor(editTarget.id, { name: editName.trim() });
    setVendors((prev) => prev.map((x) => x.id === editTarget.id ? { ...x, name: editName.trim() } : x));
    setSaving(false);
    setEditTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await adminDeleteVendor(deleteTarget.id);
    setVendors((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  };

  const statusColor = (s: string) => s === 'Open' ? '#22c55e' : s === 'Suspended' ? '#ef4444' : '#fbbf24';

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#94a3b8" />
        </Pressable>
        <Store size={20} color={ORANGE} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 }}>Vendor Management</Text>
        <Text style={{ color: '#64748b', fontSize: 12 }}>{vendors.length} vendors</Text>
      </View>

      {loading
        ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={ORANGE} /></View>
        : (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
          >
            {vendors.map((v) => (
              <View key={v.id} style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{v.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' }}>
                      <View style={{ backgroundColor: statusColor(v.status) + '22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 }}>
                        <Text style={{ color: statusColor(v.status), fontSize: 11, fontWeight: '700' }}>{v.status}</Text>
                      </View>
                      {v.orders_paused && (
                        <View style={{ backgroundColor: '#92400e44', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 }}>
                          <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700' }}>Orders Paused</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Actions row */}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Pressable
                    onPress={() => { setEditTarget(v); setEditName(v.name); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}
                  >
                    <Pencil size={13} color="#94a3b8" />
                    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>Edit</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => router.push({ pathname: '/(super-admin)/menu-editor', params: { vendorId: v.id, vendorName: v.name } } as never)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: ORANGE + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}
                  >
                    <Text style={{ color: ORANGE, fontSize: 12, fontWeight: '700' }}>Edit Menu</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => toggleSuspend(v)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: v.status === 'Suspended' ? '#16532244' : '#45090944', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}
                  >
                    <Text style={{ color: v.status === 'Suspended' ? '#22c55e' : '#f87171', fontSize: 12, fontWeight: '700' }}>
                      {v.status === 'Suspended' ? 'Reopen' : 'Suspend'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setDeleteTarget(v)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#45090922', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}
                  >
                    <Trash2 size={13} color="#f87171" />
                  </Pressable>
                </View>

                {/* Pause toggle */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>Pause New Orders</Text>
                  <Switch
                    value={v.orders_paused}
                    onValueChange={() => togglePause(v)}
                    trackColor={{ false: '#334155', true: '#f59e0b' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

      {/* Edit Name Modal */}
      <Modal visible={!!editTarget} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 24, width: '100%', borderWidth: 1, borderColor: BORDER }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Edit Vendor Name</Text>
              <Pressable onPress={() => setEditTarget(null)}><X size={20} color="#64748b" /></Pressable>
            </View>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 16 }}
              placeholderTextColor="#475569"
              placeholder="Vendor name"
            />
            <Pressable
              onPress={saveEdit}
              style={{ backgroundColor: ORANGE, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Check size={16} color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 24, width: '100%', borderWidth: 1, borderColor: '#ef4444' }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 10 }}>Delete Vendor?</Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
              Permanently delete <Text style={{ color: '#fca5a5', fontWeight: '700' }}>{deleteTarget?.name}</Text>? This cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setDeleteTarget(null)} style={{ flex: 1, backgroundColor: '#334155', borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: '#94a3b8', fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
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
