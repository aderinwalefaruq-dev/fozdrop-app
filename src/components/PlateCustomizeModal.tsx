import { View, Text, Modal, Pressable, TextInput, ScrollView } from 'react-native';
import type { MenuItem } from '@/types/types';

const ORANGE = '#F25C19';

export function PlateCustomizeModal({
  visible, item, plateNotes, onChangeNote, onClose,
}: {
  visible: boolean;
  item: MenuItem | null;
  plateNotes: string[];
  onChangeNote: (plateIndex: number, note: string) => void;
  onClose: () => void;
}) {
  if (!item) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' }}>
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
          <View style={{ width: 40, height: 4, backgroundColor: '#e5e5e5', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#1a1a1a' }}>Customize your {plateNotes.length} plates</Text>
          <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{item.item_name} — tell us what goes in each plate</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          {plateNotes.map((note, idx) => (
            <View key={idx}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 }}>Plate {idx + 1}</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 13, minHeight: 44 }}
                placeholder="e.g. no pepper, extra meat"
                value={note}
                onChangeText={(t) => onChangeNote(idx, t)}
                multiline
              />
            </View>
          ))}
        </ScrollView>
        <View style={{ padding: 20, paddingTop: 8 }}>
          <Pressable onPress={onClose} style={{ backgroundColor: ORANGE, padding: 15, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
