import { useRef } from 'react';
import { View, Text, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5; // odd number so there's a true center row
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const CENTER_INDEX = Math.floor(VISIBLE_ITEMS / 2);
const SCROLL_SETTLE_MS = 120;

const ORANGE = '#F25C19';

function WheelColumn({
  data, selectedIndex, onChange, width = 90,
}: {
  data: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width?: number;
}) {
  const listRef = useRef<FlatList<string>>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitIndex = (offsetY: number) => {
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(data.length - 1, index));
    onChange(clamped);
    // Snap precisely even if momentum stopped slightly off-center
    listRef.current?.scrollToOffset({ offset: clamped * ITEM_HEIGHT, animated: true });
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    commitIndex(e.nativeEvent.contentOffset.y);
  };

  // Web fallback: react-native-web's onMomentumScrollEnd doesn't
  // reliably fire for mouse-wheel/trackpad scrolling (it's built around
  // touch momentum physics, which the web doesn't have). Without this,
  // scrolling on web looks like it works but never actually commits a
  // new value — the picker silently keeps whatever it opened with.
  // This watches every scroll event and, once no further scroll event
  // arrives for SCROLL_SETTLE_MS, treats that as "the user stopped
  // scrolling" and commits the centered value — same end result as the
  // native event, just detected a different way. Harmless on native
  // too, since onMomentumScrollEnd already commits first there.
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => commitIndex(offsetY), SCROLL_SETTLE_MS);
  };

  return (
    <FlatList
      ref={listRef}
      data={data}
      keyExtractor={(_, i) => String(i)}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      initialScrollIndex={selectedIndex}
      contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * CENTER_INDEX }}
      style={{ height: PICKER_HEIGHT, width }}
      onMomentumScrollEnd={handleScrollEnd}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      renderItem={({ item, index }) => {
        const isSelected = index === selectedIndex;
        return (
          <View style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: isSelected ? 20 : 16, fontWeight: isSelected ? '800' : '400', color: isSelected ? '#1a1a1a' : '#aaa' }}>
              {item}
            </Text>
          </View>
        );
      }}
    />
  );
}

/**
 * Plain-React-Native scrollable time picker — hour + minute only (no
 * seconds; not a meaningful unit for a delivery time). Hour options are
 * fixed to the 11am-8pm scheduling window (see src/lib/utils/schedule.ts)
 * rather than the full 24-hour day, since any hour outside that range
 * would just be rejected by validation anyway.
 */
export function TimeWheelPicker({
  hour24, minute, onChangeHour24, onChangeMinute,
}: {
  hour24: number;
  minute: number;
  onChangeHour24: (h: number) => void;
  onChangeMinute: (m: number) => void;
}) {
  const HOURS_24 = [11, 12, 13, 14, 15, 16, 17, 18, 19]; // 11am through 7pm
  const hourLabels = HOURS_24.map((h) => (h === 11 ? '11 AM' : h === 12 ? '12 PM' : `${h - 12} PM`));
  const minuteLabels = Array.from({ length: 60 }, (_, m) => String(m).padStart(2, '0'));

  const hourIndex = Math.max(0, HOURS_24.indexOf(hour24));

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
      {/* Selection highlight band, sits behind the center row of both columns */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: ITEM_HEIGHT * CENTER_INDEX,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          borderTopWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: ORANGE,
          backgroundColor: '#fff7ed',
        }}
      />
      <WheelColumn data={hourLabels} selectedIndex={hourIndex} onChange={(i) => onChangeHour24(HOURS_24[i])} />
      <View style={{ width: 30, height: PICKER_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a1a' }}>:</Text>
      </View>
      <WheelColumn data={minuteLabels} selectedIndex={minute} onChange={onChangeMinute} width={70} />
    </View>
  );
}