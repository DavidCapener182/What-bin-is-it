import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { PlacesStyles } from '@/features/places/places-styles';
import { useAppTheme } from '@/lib/theme';
import { SavedAddress } from '@/lib/types';

function savedPlaceSummary(address: SavedAddress) {
  return address.line1.trim().toLowerCase() === address.councilName.trim().toLowerCase()
    ? address.postcode
    : `${address.line1} · ${address.postcode}`;
}

export function SavedPlacesList({
  activeAddress,
  addresses,
  onRemove,
  onSelect,
  styles,
}: {
  activeAddress?: SavedAddress;
  addresses: SavedAddress[];
  onRemove: (address: SavedAddress) => void;
  onSelect: (id: string) => void;
  styles: PlacesStyles;
}) {
  const theme = useAppTheme();
  return <>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Saved places</Text>
      <Text style={styles.count}>{addresses.length} {addresses.length === 1 ? 'place' : 'places'}</Text>
    </View>
    <View style={styles.placeList}>
      {addresses.length === 0 ? (
        <View style={styles.emptyPlaces}>
          <Ionicons color={theme.accent} name="location-outline" size={22} />
          <View style={styles.emptyPlacesCopy}>
            <Text style={styles.emptyPlacesTitle}>No saved address yet</Text>
            <Text style={styles.emptyPlacesBody}>Enter your postcode above or use your current location.</Text>
          </View>
        </View>
      ) : addresses.map((address, index) => {
        const active = address.id === activeAddress?.id;
        return (
          <ReanimatedSwipeable
            friction={2}
            key={address.id}
            overshootRight={false}
            renderRightActions={() => (
              <GesturePressable
                accessibilityLabel={`Swipe action: remove ${address.label}`}
                accessibilityRole="button"
                onPress={() => onRemove(address)}
                style={({ pressed }) => [styles.removeAction, pressed && styles.removeActionPressed]}>
                <Ionicons color="#FFFFFF" name="trash-outline" size={21} />
                <Text style={styles.removeActionText}>Remove</Text>
              </GesturePressable>
            )}
            rightThreshold={44}>
            <View style={[styles.placeCard, index !== addresses.length - 1 && styles.placeBorder, active && styles.placeActive]}>
              <Pressable
                aria-pressed={active}
                accessibilityHint="Selects this saved place"
                accessibilityLabel={`Use ${address.label}, ${address.postcode}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(address.id)}
                style={({ pressed }) => [styles.placeSelect, pressed && styles.pressed]}>
                <View style={[styles.homeIcon, active && styles.homeIconActive]}><Ionicons color={active ? theme.heroText : theme.accent} name={active ? 'home' : 'home-outline'} size={20} /></View>
                <View style={styles.placeCopy}>
                  <View style={styles.labelRow}><Text style={styles.placeLabel}>{address.label}</Text>{active && <View style={styles.activePill}><Text style={styles.activePillText}>Active</Text></View>}</View>
                  <Text style={styles.placeAddress}>{savedPlaceSummary(address)}</Text>
                  <Text style={styles.council}>{address.councilName}</Text>
                </View>
                {active ? <Ionicons color={theme.accent} name="checkmark-circle" size={22} /> : null}
              </Pressable>
              <Pressable accessibilityLabel={`Remove ${address.label}`} accessibilityRole="button" hitSlop={5} onPress={() => onRemove(address)} style={styles.visibleRemove}>
                <Ionicons color={theme.secondaryText} name="ellipsis-horizontal-circle-outline" size={23} />
              </Pressable>
            </View>
          </ReanimatedSwipeable>
        );
      })}
    </View>
    {addresses.length > 0 ? <View style={styles.swipeHint}><Ionicons color={theme.secondaryText} name="ellipsis-horizontal-circle-outline" size={15} /><Text style={styles.swipeHintText}>Use the visible menu button, or swipe left, to remove a place.</Text></View> : null}
  </>;
}
