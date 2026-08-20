import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { InlineNotice } from '@/components/resident-layout';
import { RouteHead } from '@/components/route-head';
import { ExactAddressModal } from '@/features/places/exact-address-modal';
import { createPlacesStyles } from '@/features/places/places-styles';
import { SavedPlacesList } from '@/features/places/saved-places-list';
import { usePlacesController } from '@/features/places/use-places-controller';
import { useAppTheme } from '@/lib/theme';

export default function PlacesScreen() {
  const theme = useAppTheme();
  const styles = createPlacesStyles(theme);
  const controller = usePlacesController();
  const busy = Boolean(controller.lookupMode);

  return (
    <>
      <AppShell activeRoute="/places">
        <RouteHead title="Manage Places" description="Add, choose or remove saved addresses used for verified UK bin collection dates." path="/places" private />
        <View style={styles.page}>
          <SafeAreaView edges={['top']} style={styles.safe}>
            <Text style={styles.kicker}>Addresses</Text>
            <Text style={styles.title}>Manage places</Text>
            <Text style={styles.subtitle}>Choose the addresses whose live council dates you want to keep.</Text>
          </SafeAreaView>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable accessibilityLabel="Use my current location" accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={controller.useCurrentLocation} style={({ pressed }) => [styles.locationCard, pressed && styles.pressed, busy && styles.disabled]}>
              <View style={styles.locationIcon}>{controller.lookupMode === 'location' ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons color="#FFFFFF" name="locate" size={21} />}</View>
              <View style={styles.locationCopy}><Text style={styles.locationTitle}>{controller.lookupMode === 'location' ? 'Finding your postcode…' : 'Use my current location'}</Text><Text style={styles.locationBody}>Find your postcode and local council automatically.</Text></View>
              <Ionicons color={theme.heroSecondary} name="arrow-forward" size={18} />
            </Pressable>

            {controller.feedback ? <InlineNotice body={controller.feedback.error ? 'Your saved places have not changed.' : undefined} title={controller.feedback.message} tone={controller.feedback.error ? 'danger' : 'success'} /> : null}

            {controller.showPostcodeForm ? (
              <View style={styles.addPanel}>
                <View style={styles.addHeader}>
                  <View style={styles.addHeaderCopy}><Text style={styles.addTitle}>{controller.addresses.length === 0 ? 'Enter your postcode' : 'Add a new place'}</Text><Text style={styles.addDescription}>Find the council, then choose your exact property where required.</Text></View>
                  {controller.addresses.length > 0 ? <Pressable accessibilityLabel="Close add place form" accessibilityRole="button" onPress={() => controller.setShowAdd(false)} hitSlop={8}><Ionicons color={theme.secondaryText} name="close" size={20} /></Pressable> : null}
                </View>
                <Text style={styles.fieldLabel}>UK postcode</Text>
                <TextInput accessibilityLabel="UK postcode" autoCapitalize="characters" autoCorrect={false} onSubmitEditing={controller.submitPostcode} placeholder="e.g. M1 1AE" placeholderTextColor={theme.tertiaryText} returnKeyType="search" value={controller.postcode} onChangeText={controller.setPostcode} style={styles.input} />
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={controller.submitPostcode} style={({ pressed }) => [styles.addButton, pressed && styles.pressed, busy && styles.disabled]}>
                  {controller.lookupMode === 'postcode' ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.addButtonText}>Find my collection dates</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={18} /></>}
                </Pressable>
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={controller.startAddingPlace} style={({ pressed }) => [styles.newPlace, pressed && styles.pressed]}><View style={styles.plus}><Ionicons color={theme.accent} name="add" size={22} /></View><View><Text style={styles.newPlaceTitle}>Add another place</Text><Text style={styles.newPlaceCopy}>Use a UK postcode</Text></View></Pressable>
            )}

            <SavedPlacesList activeAddress={controller.activeAddress} addresses={controller.addresses} onRemove={controller.confirmRemoveAddress} onSelect={controller.setActiveAddress} styles={styles} />

            <Pressable accessibilityRole="button" accessibilityState={{ disabled: controller.refreshing || controller.resolvingExactAddress || !controller.activeAddress }} onPress={controller.refreshOrCompleteAddress} disabled={controller.refreshing || controller.resolvingExactAddress || !controller.activeAddress} style={({ pressed }) => [styles.syncCard, pressed && styles.pressed, (controller.refreshing || controller.resolvingExactAddress || !controller.activeAddress) && styles.disabled]}>
              {controller.refreshing || controller.resolvingExactAddress ? <ActivityIndicator color={theme.accent} /> : <Ionicons color={theme.accent} name={controller.exactAddressRequired ? 'home-outline' : 'cloud-download-outline'} size={22} />}
              <View style={styles.syncCopy}><Text style={styles.syncTitle}>{controller.resolvingExactAddress ? 'Finding your property…' : controller.refreshing ? 'Checking your source…' : controller.exactAddressRequired ? 'Choose exact address' : 'Refresh collection dates'}</Text><Text style={styles.syncBody}>{controller.exactAddressRequired ? 'Required to match your property to the correct collection round.' : 'Uses the selected place and its council provider.'}</Text></View>
              <Ionicons color={theme.accent} name="arrow-forward" size={17} />
            </Pressable>
            {controller.activeAddress ? <Pressable accessibilityRole="button" onPress={() => void controller.shareActivePlace()} style={({ pressed }) => [styles.sharePlace, pressed && styles.pressed]}><Ionicons color={theme.accent} name="share-outline" size={20} /><View style={styles.syncCopy}><Text style={styles.sharePlaceTitle}>Share this place</Text><Text style={styles.sharePlaceBody}>Send the selected address and council to another household member.</Text></View><Ionicons color={theme.tertiaryText} name="chevron-forward" size={17} /></Pressable> : null}
            <View style={styles.note}><Ionicons color={theme.secondaryText} name="shield-checkmark-outline" size={17} /><Text style={styles.noteText}>Your location is used once to find the nearest postcode and is not tracked. Your selected address stays on this device. Collection dates are shown only when returned by the council source.</Text></View>
          </ScrollView>
        </View>
      </AppShell>
      <ExactAddressModal choice={controller.addressChoice} close={() => controller.setAddressChoice(undefined)} select={(address) => void controller.selectExactAddress(address)} selectingAddressId={controller.selectingAddressId} />
    </>
  );
}
