import { ScrollView, Pressable, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { Promotion } from '@/types/types';

/**
 * Horizontal scrollable carousel of admin-managed promo/ad images, shown
 * on the customer home screen. Tapping a promo navigates to its linked
 * vendor if one was set; promos with no link are just visual (e.g. a
 * general announcement graphic, not tied to one specific vendor).
 */
export function PromotionsCarousel({ promotions }: { promotions: Promotion[] }) {
  const router = useRouter();
  if (promotions.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
      style={{ marginTop: 16 }}
    >
      {promotions.map((promo) => (
        <Pressable
          key={promo.id}
          onPress={() => {
            if (promo.link_vendor_id) router.push(`/(app)/vendor/${promo.link_vendor_id}`);
          }}
          style={{ width: 280, height: 130, borderRadius: 16, overflow: 'hidden', backgroundColor: '#eee' }}
        >
          <Image source={{ uri: promo.image_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          {promo.caption ? (
            <View
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                {promo.caption}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}
