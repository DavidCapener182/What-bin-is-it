import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddressChoice } from '@/features/places/use-places-controller';
import { createPlacesStyles } from '@/features/places/places-styles';
import { useAppTheme } from '@/lib/theme';
import { CouncilAddressOption } from '@/lib/types';

export function ExactAddressModal({
  choice,
  close,
  select,
  selectingAddressId,
}: {
  choice?: AddressChoice;
  close: () => void;
  select: (address: CouncilAddressOption) => void;
  selectingAddressId?: string;
}) {
  const theme = useAppTheme();
  const styles = createPlacesStyles(theme);
  return (
    <Modal animationType="slide" onRequestClose={close} presentationStyle="pageSheet" visible={Boolean(choice)}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.addressModal}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderCopy}>
            <Text style={styles.modalKicker}>Exact property required</Text>
            <Text style={styles.modalTitle}>Choose your address</Text>
            <Text style={styles.modalBody}>A postcode can contain many collection rounds. Select the property the council should check for {choice?.place.postcode}.</Text>
          </View>
          <Pressable accessibilityLabel="Close address list" accessibilityRole="button" hitSlop={8} onPress={close} style={styles.modalClose}><Ionicons color={theme.text} name="close" size={21} /></Pressable>
        </View>
        <FlatList
          contentContainerStyle={styles.addressList}
          data={choice?.addresses ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable accessibilityLabel={`Use ${item.line1}`} accessibilityRole="button" disabled={Boolean(selectingAddressId)} onPress={() => select(item)} style={({ pressed }) => [styles.addressOption, pressed && styles.pressed, selectingAddressId && styles.disabled]}>
              <View style={styles.addressOptionIcon}><Ionicons color={theme.accent} name="home-outline" size={19} /></View>
              <View style={styles.addressOptionCopy}><Text style={styles.addressOptionTitle}>{item.line1}</Text><Text style={styles.addressOptionPostcode}>{item.postcode}</Text></View>
              {selectingAddressId === item.id ? <ActivityIndicator color={theme.accent} /> : <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
