import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { InlineNotice, ResidentSearchField } from '@/components/resident-layout';
import { ToggleIndicator } from '@/components/toggle-indicator';
import { onboardingStyles as styles } from '@/features/onboarding/onboarding-styles';
import { ResolvedPlace } from '@/lib/council-provider';
import { collectionDisplayMeta, formatCollectionDate } from '@/lib/data';
import { useAppTheme } from '@/lib/theme';
import { Collection, CouncilAddressOption } from '@/lib/types';
import { CollectionRefreshOutcome } from '@/lib/use-app-data';

const reminderTimes = [18, 19, 20, 21];

export function OnboardingSteps({
  addressQuery,
  addresses,
  busy,
  checkCollection,
  findAddress,
  finish,
  firstCollection,
  inlineError,
  place,
  postcode,
  reminderHour,
  reminders,
  selectedAddress,
  setAddressQuery,
  setPostcode,
  setReminderHour,
  setReminders,
  setSelectedAddress,
  setStep,
  step,
  verification,
  visibleAddresses,
}: {
  addressQuery: string;
  addresses: CouncilAddressOption[];
  busy: boolean;
  checkCollection: () => void;
  findAddress: () => void;
  finish: () => void;
  firstCollection?: Collection;
  inlineError?: string;
  place?: ResolvedPlace;
  postcode: string;
  reminderHour: number;
  reminders: boolean;
  selectedAddress?: CouncilAddressOption;
  setAddressQuery: (value: string) => void;
  setPostcode: (value: string) => void;
  setReminderHour: (hour: number) => void;
  setReminders: (value: boolean) => void;
  setSelectedAddress: (address: CouncilAddressOption) => void;
  setStep: (step: number) => void;
  step: number;
  verification?: CollectionRefreshOutcome;
  visibleAddresses: CouncilAddressOption[];
}) {
  const theme = useAppTheme();
  const selectedPropertyRequired = Boolean(addresses.length && !selectedAddress);
  return (
    <View style={styles.body}>
      {inlineError ? <View style={styles.inlineNotice}><InlineNotice body="Your entries are still here. Correct the issue or try the same action again." title={inlineError} tone="danger" /></View> : null}
      {step === 0 ? (
        <View style={styles.step}>
          <View style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}><Ionicons color={theme.accent} name="trash-bin-outline" size={38} /></View>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Never guess bin night again</Text>
          <Text style={[styles.copy, { color: theme.secondaryText }]}>Enter your postcode to find the right council, property and live collection source.</Text>
          <View style={[styles.promise, { backgroundColor: theme.surface, borderColor: theme.separator }]}>{[
            ['calendar-outline', 'Verified collection dates'],
            ['notifications-outline', 'Reminders you control'],
            ['document-text-outline', 'Honest missed-bin reporting'],
          ].map(([icon, label]) => <View key={label} style={styles.promiseRow}><Ionicons color={theme.accent} name={icon as keyof typeof Ionicons.glyphMap} size={21} /><Text style={[styles.promiseText, { color: theme.text }]}>{label}</Text></View>)}</View>
          <TextInput accessibilityLabel="UK postcode" autoCapitalize="characters" autoCorrect={false} onChangeText={setPostcode} onSubmitEditing={findAddress} placeholder="e.g. M1 1AE" placeholderTextColor={theme.tertiaryText} returnKeyType="go" style={[styles.postcodeInput, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }]} value={postcode} />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={findAddress} style={[styles.primary, { backgroundColor: theme.accentFill }, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Find my collection</Text>}</Pressable>
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.step}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{addresses.length ? 'Choose your property' : 'Confirm your area'}</Text>
          <Text style={[styles.copy, { color: theme.secondaryText }]}>{addresses.length ? `${place?.councilName} needs the exact property to return the correct round.` : `${place?.line1} · ${place?.postcode}`}</Text>
          {addresses.length ? <><ResidentSearchField accessibilityLabel="Search properties" clear={() => setAddressQuery('')} onChangeText={setAddressQuery} placeholder="Search address or postcode" value={addressQuery} /><FlatList data={visibleAddresses} keyExtractor={(item) => item.id} ListEmptyComponent={<Text accessibilityLiveRegion="polite" style={[styles.coverageDetail, { color: theme.secondaryText }]}>No properties match that search.</Text>} style={styles.addressList} renderItem={({ item }) => <Pressable aria-checked={selectedAddress?.id === item.id} accessibilityRole="radio" accessibilityState={{ checked: selectedAddress?.id === item.id }} onPress={() => setSelectedAddress(item)} style={[styles.addressOption, { backgroundColor: theme.surface, borderColor: selectedAddress?.id === item.id ? theme.accent : theme.separator }]}><View style={styles.addressCopy}><Text style={[styles.addressTitle, { color: theme.text }]}>{item.line1}</Text><Text style={[styles.addressPostcode, { color: theme.secondaryText }]}>{item.postcode}</Text></View><Ionicons color={selectedAddress?.id === item.id ? theme.accent : theme.tertiaryText} name={selectedAddress?.id === item.id ? 'checkmark-circle' : 'ellipse-outline'} size={22} /></Pressable>} /></> : null}
          <View style={[styles.coverageCard, { backgroundColor: theme.accentSoft }]}><Ionicons color={theme.accent} name="checkmark-circle-outline" size={22} /><View style={styles.coverageCopy}><Text style={[styles.coverageTitle, { color: theme.text }]}>Council source available to check</Text><Text style={[styles.coverageDetail, { color: theme.secondaryText }]}>We will now ask {place?.councilName} for this property’s collection dates. If live dates are unavailable, setup will still finish successfully.</Text></View></View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: selectedPropertyRequired || busy }} disabled={selectedPropertyRequired || busy} onPress={checkCollection} style={[styles.primary, { backgroundColor: theme.accentFill }, (selectedPropertyRequired || busy) && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Check collection dates</Text>}</Pressable>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.step}>
          <View style={[styles.heroIcon, { backgroundColor: verification?.verified ? `${theme.success}18` : theme.accentSoft }]}><Ionicons color={verification?.verified ? theme.success : theme.accent} name={verification?.verified ? 'checkmark' : 'link-outline'} size={40} /></View>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{verification?.verified ? 'Your first collection is ready' : 'Your address is saved'}</Text>
          <Text style={[styles.copy, { color: theme.secondaryText }]}>{verification?.message}</Text>
          {firstCollection ? <View style={[styles.resultCard, { backgroundColor: theme.surface, borderColor: theme.separator }]}><View style={[styles.resultIcon, { backgroundColor: collectionDisplayMeta(firstCollection).tint }]}><Ionicons color={collectionDisplayMeta(firstCollection).colour} name="calendar-outline" size={24} /></View><View style={styles.coverageCopy}><Text style={[styles.resultDate, { color: theme.text }]}>{formatCollectionDate(firstCollection.date, 'weekday')}</Text><Text style={[styles.resultBin, { color: theme.secondaryText }]}>{collectionDisplayMeta(firstCollection).label}</Text></View></View> : <View style={[styles.coverageCard, { backgroundColor: theme.groupedBackground }]}><Ionicons color={theme.secondaryText} name="information-circle-outline" size={22} /><Text style={[styles.coverageDetail, { color: theme.secondaryText }]}>You can retry the official source from Today. The app will never invent collection dates.</Text></View>}
          <Pressable accessibilityRole="button" onPress={() => setStep(3)} style={[styles.primary, { backgroundColor: theme.accentFill }]}><Text style={styles.primaryText}>Continue</Text></Pressable>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.step}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Would you like bin-night reminders?</Text><Text style={[styles.copy, { color: theme.secondaryText }]}>The app schedules alerts only for verified collection dates. You can change each place separately later.</Text>
          <Pressable aria-checked={reminders} accessibilityRole="switch" accessibilityState={{ checked: reminders }} onPress={() => setReminders(!reminders)} style={[styles.switchCard, { backgroundColor: theme.surface, borderColor: theme.separator }]}><View style={[styles.switchIcon, { backgroundColor: theme.accentSoft }]}><Ionicons color={theme.accent} name="notifications-outline" size={24} /></View><View style={styles.switchCopy}><Text style={[styles.switchTitle, { color: theme.text }]}>Bin-night reminders</Text><Text style={[styles.switchDetail, { color: theme.secondaryText }]}>{reminders ? 'On' : 'Off'}</Text></View><ToggleIndicator value={reminders} /></Pressable>
          {reminders ? <View accessibilityRole="radiogroup" style={[styles.timePicker, { backgroundColor: theme.groupedBackground }]}>{reminderTimes.map((hour) => <Pressable aria-checked={reminderHour === hour} accessibilityRole="radio" accessibilityState={{ checked: reminderHour === hour }} key={hour} onPress={() => setReminderHour(hour)} style={[styles.time, reminderHour === hour && { backgroundColor: theme.surface }]}><Text style={[styles.timeText, { color: reminderHour === hour ? theme.accent : theme.secondaryText }]}>{hour}:00</Text></Pressable>)}</View> : null}
          <Pressable accessibilityRole="button" onPress={() => setStep(4)} style={[styles.primary, { backgroundColor: theme.accentFill }]}><Text style={styles.primaryText}>Continue</Text></Pressable>
        </View>
      ) : null}

      {step === 4 ? (
        <View style={styles.step}>
          <View style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}><Ionicons color={theme.accent} name="notifications-outline" size={38} /></View><Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{reminders ? 'Allow notifications' : 'Notifications are optional'}</Text><Text style={[styles.copy, { color: theme.secondaryText }]}>{reminders ? 'Your phone or browser will show its own permission prompt. On iPhone web, install the app to the Home Screen first.' : 'You can turn reminders on for any saved place from Settings.'}</Text>
          <View style={[styles.confirmation, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.confirmTitle, { color: theme.text }]}>{selectedAddress?.line1 ?? place?.line1}</Text><Text style={[styles.confirmDetail, { color: theme.secondaryText }]}>{place?.postcode} · {place?.councilName}</Text><Text style={[styles.confirmDetail, { color: theme.secondaryText }]}>Reminders: {reminders ? `${reminderHour}:00 the night before` : 'Not enabled'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={finish} style={[styles.primary, { backgroundColor: theme.accentFill }, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{reminders ? 'Allow notifications and finish' : 'Finish setup'}</Text>}</Pressable>
        </View>
      ) : null}
    </View>
  );
}
