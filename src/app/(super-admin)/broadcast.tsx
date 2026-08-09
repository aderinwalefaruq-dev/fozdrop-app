/**
 * Admin — Global Broadcast System
 * Compose campus announcements → push to Customers / Vendors / Operators / All.
 */
import {
  View, Text, ScrollView, Pressable, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Megaphone, Send } from 'lucide-react-native';

import { getAnnouncements } from '@/db/api';
import { supabase } from '@/client/supabase';
import type { Announcement } from '@/types/types';

const ORANGE = '#F25C19';
const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';

const AUDIENCES = [
  { label: 'All Users',  value: 'All',      emoji: '🌍' },
  { label: 'Customers',  value: 'Customer',  emoji: '🛒' },
  { label: 'Vendors',    value: 'Vendor',    emoji: '🍳' },
  { label: 'Riders',     value: 'Operator',  emoji: '🛵' },
] as const;

type AudienceValue = typeof AUDIENCES[number]['value'];

export default function AdminBroadcast() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<AudienceValue>('All');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [histLoading, setHistLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    const data = await getAnnouncements(15);
    setHistory(data);
    setHistLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { setHistLoading(true); loadHistory(); }, [loadHistory]));

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      setMsg({ text: 'Title and message are required.', ok: false });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setSending(true);
    const { error } = await supabase.functions.invoke('admin-broadcast', {
      body: { title: title.trim(), message: message.trim(), targetAudience: audience },
    });
    setSending(false);
    if (error) {
      setMsg({ text: 'Broadcast failed. Try again.', ok: false });
    } else {
      setMsg({ text: `✅ Announcement sent to ${audience === 'All' ? 'all users' : audience + 's'}!`, ok: true });
      setTitle('');
      setMessage('');
      loadHistory();
    }
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}><ArrowLeft size={22} color="#94a3b8" /></Pressable>
        <Megaphone size={20} color={ORANGE} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Broadcast</Text>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic">
        {/* Composer */}
        <View style={{ marginHorizontal: 16, backgroundColor: CARD, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: BORDER, marginBottom: 20 }}>
          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
            New Announcement
          </Text>

          {msg && (
            <View style={{ backgroundColor: msg.ok ? '#14532d' : '#450a0a', borderRadius: 10, padding: 10, marginBottom: 14 }}>
              <Text style={{ color: msg.ok ? '#86efac' : '#fca5a5', fontSize: 13, textAlign: 'center' }}>{msg.text}</Text>
            </View>
          )}

          <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 5 }}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Campus Delivery Disruption"
            placeholderTextColor="#475569"
            style={{ backgroundColor: BG, color: '#fff', borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 12 }}
          />

          <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 5 }}>Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Write your campus announcement…"
            placeholderTextColor="#475569"
            multiline
            numberOfLines={4}
            style={{ backgroundColor: BG, color: '#fff', borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 16, minHeight: 100, textAlignVertical: 'top' }}
          />

          <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 10 }}>Target Audience</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {AUDIENCES.map(({ label, value, emoji }) => (
              <Pressable
                key={value}
                onPress={() => setAudience(value)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: audience === value ? ORANGE : '#334155', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: audience === value ? ORANGE : BORDER }}
              >
                <Text style={{ fontSize: 14 }}>{emoji}</Text>
                <Text style={{ color: audience === value ? '#fff' : '#94a3b8', fontWeight: '700', fontSize: 13 }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={handleSend}
            style={{ backgroundColor: ORANGE, borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send size={18} color="#fff" />}
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
              {sending ? 'Sending…' : 'Send Announcement'}
            </Text>
          </Pressable>
        </View>

        {/* History */}
        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 16, marginBottom: 10 }}>
          Recent Broadcasts
        </Text>
        {histLoading
          ? <ActivityIndicator color={ORANGE} style={{ marginTop: 20 }} />
          : history.length === 0
            ? <Text style={{ color: '#475569', textAlign: 'center' }}>No announcements yet</Text>
            : history.map((a) => (
              <View key={a.id} style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: CARD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, flex: 1 }}>{a.title}</Text>
                  <View style={{ backgroundColor: ORANGE + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                    <Text style={{ color: ORANGE, fontSize: 10, fontWeight: '700' }}>{a.target_audience}</Text>
                  </View>
                </View>
                <Text style={{ color: '#94a3b8', fontSize: 12 }} numberOfLines={2}>{a.message}</Text>
                <Text style={{ color: '#475569', fontSize: 11, marginTop: 6 }}>{new Date(a.created_at).toLocaleString()}</Text>
              </View>
            ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
