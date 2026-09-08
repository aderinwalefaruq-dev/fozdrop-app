import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { getLatestUnreadAnnouncement, markAnnouncementRead } from '@/db/api';
import type { Announcement } from '@/types/types';

const ORANGE = '#F25C19';

/**
 * A dismissible banner shown at the top of a role's home screen for the
 * latest admin announcement that user hasn't seen yet. Only ever shows
 * one at a time — dismissing it doesn't immediately reveal the next
 * (that happens on the next screen load), which keeps this simple and
 * matches "a banner, not a popup" rather than a notification-center-style
 * stack.
 */
export function AnnouncementBanner({ role, userId }: { role: string; userId: string }) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLatestUnreadAnnouncement(role, userId).then((a) => {
      if (!cancelled) setAnnouncement(a);
    });
    return () => { cancelled = true; };
  }, [role, userId]);

  if (!announcement || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    markAnnouncementRead(announcement.id, userId).catch(() => {});
  };

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#fff7ed',
        borderWidth: 1.5,
        borderColor: ORANGE,
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <Text style={{ fontSize: 18 }}>📣</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#9a3412' }}>{announcement.title}</Text>
        <Text style={{ fontSize: 12, color: '#9a3412', marginTop: 3 }}>{announcement.message}</Text>
      </View>
      <Pressable onPress={dismiss} hitSlop={8}>
        <Text style={{ fontSize: 16, color: '#9a3412', fontWeight: '900' }}>✕</Text>
      </Pressable>
    </View>
  );
}
