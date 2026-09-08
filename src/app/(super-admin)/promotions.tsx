/**
 * Admin — Promotions / Ad Carousel Manager
 * Manage the image carousel shown at the top of the customer home screen.
 */
import {
  View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ImagePlus, Trash2 } from 'lucide-react-native';

import { getAdminPromotions, adminCreatePromotion, adminUpdatePromotion, adminDeletePromotion, getVendors } from '@/db/api';
import type { Promotion, Vendor } from '@/types/types';

const ORANGE = '#F25C19';
const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';

export default function AdminPromotions() {
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [linkVendorId, setLinkVendorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const [promos, v] = await Promise.all([getAdminPromotions(), getVendors()]);
    setPromotions(promos);
    setVendors(v);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const handleAdd = async () => {
    if (!imageUrl.trim()) {
      setMsg({ text: 'Image URL is required.', ok: false });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setSaving(true);
    const { error } = await adminCreatePromotion({
      image_url: imageUrl.trim(),
      caption: caption.trim() || undefined,
      link_vendor_id: linkVendorId,
      sort_order: promotions.length,
    });
    setSaving(false);
    if (error) {
      setMsg({ text: 'Failed to add promotion.', ok: false });
    } else {
      setMsg({ text: '✅ Promotion added!', ok: true });
      setImageUrl('');
      setCaption('');
      setLinkVendorId(null);
      load();
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const toggleActive = async (promo: Promotion) => {
    await adminUpdatePromotion(promo.id, { is_active: !promo.is_active });
    load();
  };

  const remove = async (id: string) => {
    await adminDeletePromotion(id);
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}><ArrowLeft size={22} color="#94a3b8" /></Pressable>
        <ImagePlus size={20} color={ORANGE} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Promotions</Text>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic">
        {/* Composer */}
        <View style={{ marginHorizontal: 16, backgroundColor: CARD, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: BORDER, marginBottom: 20 }}>
          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
            New Promotion
          </Text>

          {msg && (
            <View style={{ backgroundColor: msg.ok ? '#14532d' : '#450a0a', borderRadius: 10, padding: 10, marginBottom: 14 }}>
              <Text style={{ color: msg.ok ? '#86efac' : '#fca5a5', fontSize: 13, textAlign: 'center' }}>{msg.text}</Text>
            </View>
          )}

          <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 5 }}>Image URL</Text>
          <TextInput
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://example.com/promo.jpg"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            style={{ backgroundColor: BG, color: '#fff', borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 12 }}
          />

          <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 5 }}>Caption (optional)</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="e.g. 20% off this week only!"
            placeholderTextColor="#475569"
            style={{ backgroundColor: BG, color: '#fff', borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 16 }}
          />

          <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 10 }}>Link to vendor (optional — tapping the ad opens their page)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setLinkVendorId(null)}
                style={{ backgroundColor: linkVendorId === null ? ORANGE : '#334155', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: linkVendorId === null ? ORANGE : BORDER }}
              >
                <Text style={{ color: linkVendorId === null ? '#fff' : '#94a3b8', fontWeight: '700', fontSize: 13 }}>No link</Text>
              </Pressable>
              {vendors.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => setLinkVendorId(v.id)}
                  style={{ backgroundColor: linkVendorId === v.id ? ORANGE : '#334155', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: linkVendorId === v.id ? ORANGE : BORDER }}
                >
                  <Text style={{ color: linkVendorId === v.id ? '#fff' : '#94a3b8', fontWeight: '700', fontSize: 13 }}>{v.name}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Pressable
            onPress={handleAdd}
            style={{ backgroundColor: ORANGE, borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <ImagePlus size={18} color="#fff" />}
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
              {saving ? 'Adding…' : 'Add Promotion'}
            </Text>
          </Pressable>
        </View>

        {/* Existing promotions */}
        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 16, marginBottom: 10 }}>
          Current Promotions
        </Text>
        {loading
          ? <ActivityIndicator color={ORANGE} style={{ marginTop: 20 }} />
          : promotions.length === 0
            ? <Text style={{ color: '#475569', textAlign: 'center' }}>No promotions yet</Text>
            : promotions.map((promo) => (
              <View key={promo.id} style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: CARD, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Image source={{ uri: promo.image_url }} style={{ width: 70, height: 50, borderRadius: 8, backgroundColor: '#334155' }} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  {promo.caption ? (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{promo.caption}</Text>
                  ) : (
                    <Text style={{ color: '#64748b', fontStyle: 'italic', fontSize: 13 }}>No caption</Text>
                  )}
                  {promo.link_vendor_id ? (
                    <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                      → {vendors.find((v) => v.id === promo.link_vendor_id)?.name ?? 'Unknown vendor'}
                    </Text>
                  ) : null}
                </View>
                <Switch value={promo.is_active} onValueChange={() => toggleActive(promo)} trackColor={{ false: BORDER, true: ORANGE }} />
                <Pressable onPress={() => remove(promo.id)} hitSlop={8}>
                  <Trash2 size={18} color="#f87171" />
                </Pressable>
              </View>
            ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
