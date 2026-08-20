import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BinGlyph, WasteIcon } from '@/components/bin-glyph';
import { type CollectionLifecycle } from '@/lib/collection-lifecycle';
import { collectionDisplayMeta, dayDifference, formatCollectionDate } from '@/lib/data';
import { type AppTheme } from '@/lib/theme';
import { type Collection, type CollectionOutcome, type DisruptionAlert, type MissedCollectionReport, type SavedAddress } from '@/lib/types';
import { type AdaptiveLayoutMode } from '@/lib/use-adaptive-layout';
import { type TodayStyles } from '@/features/collections/today-styles';

type SharedProps = { styles: TodayStyles; theme: AppTheme };

export function TodaySetup({ error, onChange, onContinue, postcode, styles, theme }: SharedProps & {
  error: string;
  onChange(value: string): void;
  onContinue(): void;
  postcode: string;
}) {
  return (
    <View style={styles.page}>
      <LinearGradient colors={[theme.hero, theme.hero]} style={styles.setupHero}>
        <SafeAreaView edges={['top']}>
          <Text style={styles.eyebrow}>What Bin Is It Tonight?</Text>
          <Text style={styles.setupTitle}>Find your collection dates.</Text>
          <Text style={styles.setupSubtitle}>Add one UK postcode and we’ll check its live council source.</Text>
        </SafeAreaView>
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.setupContent} keyboardShouldPersistTaps="handled">
        <View style={styles.setupCard}>
          <Text style={styles.fieldLabel}>UK postcode</Text>
          <TextInput accessibilityLabel="UK postcode" autoCapitalize="characters" autoCorrect={false} onChangeText={onChange} onSubmitEditing={onContinue} placeholder="e.g. M1 1AE" placeholderTextColor={theme.tertiaryText} returnKeyType="go" style={[styles.input, error && styles.inputError]} value={postcode} />
          {error ? <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{error}</Text> : null}
          <Pressable accessibilityRole="button" onPress={onContinue} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Continue</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={19} />
          </Pressable>
          <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>OR</Text><View style={styles.orLine} /></View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/places')} style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}>
            <Ionicons color={theme.accent} name="locate-outline" size={20} /><Text style={styles.locationButtonText}>Use my current location</Text>
          </Pressable>
        </View>
        <View style={styles.privacyLine}><Ionicons color={theme.secondaryText} name="shield-checkmark-outline" size={18} /><Text style={styles.privacyText}>Your location is used once. Your saved address stays on this device.</Text></View>
      </ScrollView>
    </View>
  );
}

export function TodayHero({
  activeAddress, daysAway, heroAccent, heroColour, heroControl, heroForeground, heroOrb,
  heroSecondary, heroSubtitle, heroTitle, onChooseAddress, styles, tonight, unreadAlertCount,
}: { activeAddress: SavedAddress; daysAway: number | null; heroAccent: string; heroColour: string; heroControl: string; heroForeground: string; heroOrb: string; heroSecondary: string; heroSubtitle: string; heroTitle: string; onChooseAddress(): void; styles: TodayStyles; tonight: boolean; unreadAlertCount: number }) {
  return (
    <LinearGradient colors={[heroColour, heroColour]} nativeID="today-hero" style={styles.hero}>
      <SafeAreaView edges={['top']}>
        <View style={styles.heroTop}>
          <View style={styles.heroBrand}><Text style={[styles.eyebrow, { color: heroAccent }]}>What Bin Is It Tonight?</Text><Text accessibilityLiveRegion="polite" style={[styles.greeting, { color: heroForeground }]}>{heroTitle}</Text></View>
          <View style={styles.heroActions}>
            <Pressable accessibilityLabel="Manage addresses" accessibilityRole="button" onPress={onChooseAddress} style={({ pressed }) => [styles.addressButton, { backgroundColor: heroControl }, pressed && styles.pressed]}><Ionicons color={heroForeground} name="location-outline" size={21} /></Pressable>
            <Pressable accessibilityLabel={unreadAlertCount ? `Open Activity, ${unreadAlertCount} unread alert${unreadAlertCount === 1 ? '' : 's'}` : 'Open Activity'} accessibilityRole="button" onPress={() => router.push('/activity' as Href)} style={({ pressed }) => [styles.addressButton, { backgroundColor: heroControl }, pressed && styles.pressed]}>
              <Ionicons color={heroForeground} name="notifications-outline" size={21} />{unreadAlertCount ? <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{Math.min(99, unreadAlertCount)}</Text></View> : null}
            </Pressable>
          </View>
        </View>
        <View accessibilityLiveRegion="polite" style={styles.heroInfoRow}>
          <View style={styles.heroInfoCopy}>
            <Pressable accessibilityLabel="Choose saved address" accessibilityRole="button" hitSlop={8} onPress={onChooseAddress} style={({ pressed }) => [styles.addressLine, pressed && styles.pressed]}><Ionicons color={heroSecondary} name="home-outline" size={17} /><Text numberOfLines={1} style={[styles.addressText, { color: heroSecondary }]}>{activeAddress.label}</Text><Ionicons color={heroSecondary} name="chevron-down" size={15} /></Pressable>
            <Text style={[styles.answerSubtitle, { color: heroSecondary }]}>{heroSubtitle}</Text>
          </View>
          <View style={[styles.countdownOrb, { backgroundColor: heroOrb, borderColor: heroAccent }]}><Text style={[styles.countdownNumber, { color: heroForeground }]}>{tonight ? 'TONIGHT' : daysAway === null ? '—' : daysAway}</Text>{!tonight && daysAway !== null ? <Text style={[styles.countdownCaption, { color: heroAccent }]}>{daysAway === 1 ? 'DAY' : 'DAYS'}</Text> : null}</View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

export function SavedPlacesStrip({ activeAddress, addresses, mode, onSelect, styles, theme }: SharedProps & { activeAddress: SavedAddress; addresses: SavedAddress[]; mode: AdaptiveLayoutMode; onSelect(id: string): void }) {
  if (mode === 'compact' || addresses.length < 2) return null;
  return (
    <View accessibilityLabel="Saved places" style={styles.savedPlaces}><Text style={styles.savedPlacesLabel}>Saved places</Text><View style={styles.savedPlacesList}>
      {addresses.map((address) => { const selected = address.id === activeAddress.id; return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={address.id} onPress={() => onSelect(address.id)} style={({ pressed }) => [styles.savedPlace, selected && styles.savedPlaceSelected, pressed && styles.pressed]}><Ionicons color={selected ? '#FFFFFF' : theme.accent} name={selected ? 'home' : 'home-outline'} size={17} /><Text numberOfLines={1} style={[styles.savedPlaceText, selected && styles.savedPlaceTextSelected]}>{address.label}</Text></Pressable>; })}
      <Pressable accessibilityRole="button" onPress={() => router.push('/places')} style={({ pressed }) => [styles.savedPlaceAdd, pressed && styles.pressed]}><Ionicons color={theme.accent} name="add" size={18} /><Text style={styles.savedPlaceAddText}>Manage</Text></Pressable>
    </View></View>
  );
}

export type TodayPrimaryPaneProps = SharedProps & {
  actionCollections: Collection[]; actionDate?: string; actionDisruption?: DisruptionAlert; actionOutcomes: (CollectionOutcome | undefined)[]; actionReport?: MissedCollectionReport;
  activeAddress: SavedAddress; assignedMemberName?: string; canRequestCouncil: boolean; changeNotice?: string; collectionDataState: string; completed: boolean; councilRequestError?: string; councilRequested: boolean; exactAddressRequired: boolean;
  lifecycle?: CollectionLifecycle; missedCollectionEnabled: boolean; next?: Collection; nextCardForeground: string; nextCardMark?: string; nextCardSecondary: string; nextDayCollections: Collection[]; online: boolean;
  onBroughtIn(): void; onConfirmCollected(): void; onCopyReference(): void; onMarkOut(): void; onRefresh(): void; onReportMissed(): void; onRequestCouncil(): void;
  placeRemindersEnabled: boolean; primaryNextColour?: string; refreshing: boolean; reportReferenceCopied: boolean; requestingCouncil: boolean; showHousehold: boolean; sourceSummary: string; tonight: boolean; usesCouncilBinColour: boolean;
};

export function TodayPrimaryPane(props: TodayPrimaryPaneProps) {
  const { styles, theme } = props;
  const primaryNextMeta = props.next ? collectionDisplayMeta(props.next) : undefined;
  return (
    <View style={styles.primaryColumn}>
      {props.exactAddressRequired ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/places')} style={({ pressed }) => [styles.setupRequiredCard, pressed && styles.pressed]}><View style={styles.actionIcon}><Ionicons color="#FFFFFF" name="home-outline" size={23} /></View><View style={styles.cardCopy}><Text style={styles.cardTitle}>Select your property</Text><Text style={styles.cardBody}>This prevents dates from the wrong collection round.</Text></View><Ionicons color={theme.secondaryText} name="arrow-forward" size={20} /></Pressable>
      ) : props.actionCollections.length ? (
        <View style={[styles.actionCard, props.completed && styles.actionCardComplete]}>
          <View style={styles.actionHeader}><View><Text style={styles.sectionKicker}>{props.tonight ? 'TONIGHT' : 'Collection status'}</Text><Text style={styles.actionTitle}>{props.lifecycle?.title ?? formatCollectionDate(props.actionDate!, 'weekday')}</Text></View>{props.lifecycle?.stage === 'collected' || props.completed ? <Ionicons color={theme.success} name="checkmark-circle" size={30} /> : null}</View>
          {props.lifecycle ? <Text style={styles.lifecycleDetail}>{props.lifecycle.detail}</Text> : null}
          <View style={styles.actionBins}>{props.actionCollections.map((collection) => { const meta = collectionDisplayMeta(collection); return <View key={collection.id} style={styles.actionBinRow}><View style={[styles.iconDisc, { backgroundColor: meta.tint }]}><WasteIcon colour={meta.colour} type={collection.wasteType} /></View><Text style={styles.actionBinName}>{meta.label}</Text></View>; })}</View>
          {props.showHousehold ? <Pressable accessibilityRole="button" onPress={() => router.push('/household' as Href)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Ionicons color={theme.accent} name="people-outline" size={19} /><Text style={styles.secondaryActionText}>{props.assignedMemberName ? `${props.assignedMemberName} is putting it out` : 'Choose who is putting it out'}</Text></Pressable> : null}
          {props.lifecycle?.canMarkPutOut || props.completed ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: props.completed }} disabled={props.completed} onPress={props.onMarkOut} style={({ pressed }) => [styles.completeButton, props.completed && styles.completeButtonDone, pressed && styles.pressed]}><Ionicons color={props.completed ? theme.accent : '#FFFFFF'} name={props.completed ? 'checkmark-circle' : 'arrow-up-circle-outline'} size={20} /><Text accessibilityLiveRegion="polite" style={[styles.completeButtonText, props.completed && styles.completeButtonTextDone]}>{props.completed ? 'Marked as out' : 'I’ve put it out'}</Text></Pressable> : null}
          {props.lifecycle?.stage === 'before' ? <Pressable accessibilityRole="button" onPress={() => router.push('/reminder-settings' as Href)} style={({ pressed }) => [styles.reminderStatus, pressed && styles.pressed]}><Ionicons color={props.placeRemindersEnabled ? theme.success : theme.secondaryText} name={props.placeRemindersEnabled ? 'notifications' : 'notifications-off-outline'} size={17} /><Text style={styles.reminderStatusText}>{props.placeRemindersEnabled ? 'Bin-night reminder is on' : 'Bin-night reminder is off'}</Text><Ionicons color={theme.tertiaryText} name="chevron-forward" size={16} /></Pressable> : null}
          {props.lifecycle?.stage === 'collected' && props.actionOutcomes[0]?.status !== 'brought-in' ? <Pressable accessibilityRole="button" onPress={props.onBroughtIn} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Ionicons color={theme.accent} name="return-down-back-outline" size={19} /><Text style={styles.secondaryActionText}>Mark bin as brought in</Text></Pressable> : null}
          {props.actionDisruption && props.lifecycle?.stage !== 'missed' ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(props.actionDisruption!.sourceUrl)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Ionicons color={theme.accent} name="megaphone-outline" size={19} /><Text style={styles.secondaryActionText}>View council update</Text></Pressable> : null}
          {props.lifecycle?.stage === 'missed' ? <ReportActions {...props} /> : null}
          {props.lifecycle?.canConfirmCollected && props.lifecycle.stage !== 'missed' ? <View style={styles.outcomeActions}><Pressable accessibilityRole="button" onPress={props.onConfirmCollected} style={({ pressed }) => [styles.collectedButton, pressed && styles.pressed]}><Ionicons color="#FFFFFF" name="checkmark-circle-outline" size={19} /><Text style={styles.completeButtonText}>It was collected</Text></Pressable>{props.missedCollectionEnabled ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: !props.lifecycle.canReportMissed }} disabled={!props.lifecycle.canReportMissed} onPress={props.onReportMissed} style={({ pressed }) => [styles.missedButton, !props.lifecycle?.canReportMissed && styles.actionDisabled, pressed && styles.pressed]}><Ionicons color={theme.danger} name="alert-circle-outline" size={19} /><Text style={styles.missedButtonText}>No, it was missed</Text></Pressable> : null}</View> : null}
          {props.lifecycle?.blockedReason ? <Text style={styles.blockedReason}>{props.lifecycle.blockedReason}</Text> : null}
        </View>
      ) : props.next ? (
        <Pressable accessibilityLabel={`Open schedule for ${collectionDisplayMeta(props.next).label}`} accessibilityRole="button" onPress={() => router.push('/schedule')} style={({ pressed }) => [styles.collectionCard, props.usesCouncilBinColour && primaryNextMeta && { backgroundColor: primaryNextMeta.colour, borderColor: primaryNextMeta.colour }, pressed && styles.pressed]}>
          <View style={[styles.collectionColour, { backgroundColor: props.usesCouncilBinColour ? props.nextCardForeground : props.primaryNextColour ?? collectionDisplayMeta(props.next).colour }]} />
          <View style={[styles.collectionBinMark, props.nextCardMark ? { backgroundColor: props.nextCardMark } : null]}><BinGlyph colour={props.usesCouncilBinColour ? props.nextCardForeground : props.primaryNextColour ?? collectionDisplayMeta(props.next).colour} size={36} /></View>
          <View style={styles.cardCopy}><Text style={[styles.cardKicker, { color: props.nextCardSecondary }]}>Next collection</Text><Text style={[styles.cardTitle, { color: props.nextCardForeground }]}>{props.nextDayCollections.map((collection) => collectionDisplayMeta(collection).label).join(' + ')}</Text><Text style={[styles.cardBody, { color: props.nextCardSecondary }]}>{formatCollectionDate(props.next.date, 'weekday')}</Text></View><Ionicons color={props.usesCouncilBinColour ? props.nextCardForeground : theme.tertiaryText} name="chevron-forward" size={20} />
        </Pressable>
      ) : <NoDates {...props} />}
      <Pressable accessibilityLabel="Refresh verified collection data" accessibilityRole="button" accessibilityState={{ disabled: props.refreshing || !props.online }} disabled={props.refreshing || !props.online} onPress={props.onRefresh} style={({ pressed }) => [styles.sourceLine, pressed && styles.pressed]}>{props.refreshing ? <ActivityIndicator color={theme.accent} /> : <Ionicons color={props.online ? theme.accent : theme.secondaryText} name={props.online ? 'checkmark-circle-outline' : 'cloud-offline-outline'} size={20} />}<Text accessibilityLiveRegion="polite" numberOfLines={3} style={styles.sourceText}>{props.sourceSummary}</Text><Ionicons color={theme.secondaryText} name="refresh" size={18} /></Pressable>
      {props.changeNotice ? <View accessibilityLiveRegion="polite" style={styles.changeNotice}><View style={styles.changeIcon}><Ionicons color={theme.warning} name="alert-circle-outline" size={21} /></View><View style={styles.changeCopy}><Text style={styles.changeTitle}>Your council changed a date</Text><Text style={styles.changeBody}>{props.changeNotice.replace(/^Collection date changed · /, '')}</Text><Text style={styles.changeFoot}>Your reminders have been updated to the latest verified schedule.</Text></View></View> : null}
    </View>
  );
}

function ReportActions(props: TodayPrimaryPaneProps) {
  return <View style={props.styles.quickActions}><Pressable accessibilityRole="button" onPress={() => router.push('/activity' as Href)} style={({ pressed }) => [props.styles.quickAction, pressed && props.styles.pressed]}><Ionicons color={props.theme.accent} name="document-text-outline" size={18} /><Text style={props.styles.quickActionText}>{props.actionReport ? 'View report' : 'Activity'}</Text></Pressable>{props.actionReport ? <Pressable accessibilityRole="button" onPress={props.onCopyReference} style={({ pressed }) => [props.styles.quickAction, pressed && props.styles.pressed]}><Ionicons color={props.theme.accent} name={props.reportReferenceCopied ? 'checkmark-outline' : 'copy-outline'} size={18} /><Text style={props.styles.quickActionText}>{props.reportReferenceCopied ? 'Copied' : 'Copy reference'}</Text></Pressable> : null}{props.actionReport ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(props.actionReport!.officialServiceUrl)} style={({ pressed }) => [props.styles.quickAction, pressed && props.styles.pressed]}><Ionicons color={props.theme.accent} name="open-outline" size={18} /><Text style={props.styles.quickActionText}>Council website</Text></Pressable> : null}</View>;
}

function NoDates(props: TodayPrimaryPaneProps) {
  return <><Pressable accessibilityRole="button" disabled={props.refreshing || !props.online} onPress={props.onRefresh} style={({ pressed }) => [props.styles.emptySchedule, pressed && props.styles.pressed]}><Ionicons color={props.online ? props.theme.accent : props.theme.secondaryText} name={props.online ? 'calendar-outline' : 'cloud-offline-outline'} size={26} /><View style={props.styles.emptyScheduleCopy}><Text style={props.styles.emptyScheduleTitle}>{props.collectionDataState === 'error' ? 'Council check unavailable' : 'No verified dates for this place'}</Text><Text style={props.styles.emptyScheduleBody}>{props.online ? 'Tap to check the live council source again.' : 'Reconnect to check for collection dates.'}</Text></View><Ionicons color={props.theme.tertiaryText} name="arrow-forward" size={19} /></Pressable>{props.canRequestCouncil ? <View style={props.styles.councilDemandCard}><View style={props.styles.councilDemandIcon}><Ionicons color={props.theme.accent} name="people-outline" size={22} /></View><View style={props.styles.councilDemandCopy}><Text style={props.styles.councilDemandKicker}>Council connection</Text><Text style={props.styles.councilDemandTitle}>Ask {props.activeAddress.councilName} to connect</Text><Text style={props.styles.councilDemandBody}>Your postcode already counts once in its anonymous resident total. This request asks for live official dates and an availability alert.</Text></View><Pressable accessibilityRole="button" accessibilityState={{ disabled: props.councilRequested || props.requestingCouncil }} disabled={props.councilRequested || props.requestingCouncil} onPress={props.onRequestCouncil} style={({ pressed }) => [props.styles.councilDemandButton, props.councilRequested && props.styles.councilDemandButtonDone, pressed && props.styles.pressed]}>{props.requestingCouncil ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons color={props.councilRequested ? props.theme.success : '#FFFFFF'} name={props.councilRequested ? 'checkmark-circle' : 'megaphone-outline'} size={18} />}<Text style={[props.styles.councilDemandButtonText, props.councilRequested && { color: props.theme.success }]}>{props.councilRequested ? 'Request saved' : 'Request my council'}</Text></Pressable>{props.councilRequestError ? <Text accessibilityRole="alert" style={props.styles.errorText}>{props.councilRequestError}</Text> : null}</View> : null}</>;
}

export function TodayContextPane({ placeRemindersEnabled, soonest, styles, theme }: SharedProps & { placeRemindersEnabled: boolean; soonest: Collection[] }) {
  return <View style={styles.contextColumn}>{soonest.length ? <><View style={styles.sectionHeading}><View><Text style={styles.sectionKicker}>Coming up</Text><Text style={styles.sectionTitle}>Next collections</Text></View><Pressable accessibilityRole="button" onPress={() => router.push('/schedule')} style={styles.linkButton}><Text style={styles.linkText}>Full schedule</Text><Ionicons color={theme.accent} name="arrow-forward" size={16} /></Pressable></View><View style={styles.scheduleList}>{soonest.map((collection) => { const meta = collectionDisplayMeta(collection); const diff = dayDifference(collection.date); return <View key={collection.id} style={styles.scheduleRow}><View style={styles.dayBlock}><Text style={styles.dayName}>{diff === 0 ? 'Today' : formatCollectionDate(collection.date, 'day')}</Text><Text style={styles.dayNumber}>{formatCollectionDate(collection.date, 'dateNumber')}</Text></View><View style={[styles.iconDisc, { backgroundColor: meta.tint }]}><WasteIcon colour={meta.colour} type={collection.wasteType} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{meta.label}</Text><Text style={styles.rowBody}>{diff === 1 ? 'Tomorrow' : formatCollectionDate(collection.date, 'short')}</Text></View><View style={[styles.dot, { backgroundColor: meta.colour }]} /></View>; })}</View></> : null}<View style={styles.contextLinks}><Pressable accessibilityRole="button" onPress={() => router.push('/reminder-settings' as Href)} style={({ pressed }) => [styles.contextLink, pressed && styles.pressed]}><Ionicons color={theme.accent} name="notifications-outline" size={20} /><View style={styles.contextLinkCopy}><Text style={styles.contextLinkTitle}>Reminders</Text><Text style={styles.contextLinkBody}>{placeRemindersEnabled ? 'On for this place' : 'Off for this place'}</Text></View><Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} /></Pressable><Pressable accessibilityRole="button" onPress={() => router.push('/activity' as Href)} style={({ pressed }) => [styles.contextLink, pressed && styles.pressed]}><Ionicons color={theme.accent} name="time-outline" size={20} /><View style={styles.contextLinkCopy}><Text style={styles.contextLinkTitle}>Recent activity</Text><Text style={styles.contextLinkBody}>Reports, council updates and household actions</Text></View><Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} /></Pressable></View></View>;
}

export function TodayAddressPicker({ activeAddress, addresses, onClose, onSelect, styles, theme, visible }: SharedProps & { activeAddress: SavedAddress; addresses: SavedAddress[]; onClose(): void; onSelect(id: string): void; visible: boolean }) {
  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}><SafeAreaView edges={['top', 'bottom']} style={styles.pickerPage}><View style={styles.pickerHeader}><View><Text style={styles.modalKicker}>Current place</Text><Text style={styles.modalTitle}>Choose an address</Text></View><Pressable accessibilityLabel="Close address picker" accessibilityRole="button" onPress={onClose} style={styles.modalClose}><Ionicons color={theme.text} name="close" size={22} /></Pressable></View><ScrollView contentContainerStyle={styles.pickerContent}><View style={styles.pickerList}>{addresses.map((address) => { const active = address.id === activeAddress.id; return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={address.id} onPress={() => onSelect(address.id)} style={({ pressed }) => [styles.pickerRow, active && styles.pickerRowActive, pressed && styles.pressed]}><View style={[styles.pickerIcon, active && styles.pickerIconActive]}><Ionicons color={active ? '#FFFFFF' : theme.accent} name={active ? 'home' : 'home-outline'} size={21} /></View><View style={styles.pickerCopy}><Text style={styles.pickerTitle}>{address.label}</Text><Text style={styles.pickerBody}>{address.line1} · {address.postcode}</Text></View>{active ? <Ionicons color={theme.accent} name="checkmark-circle" size={23} /> : null}</Pressable>; })}</View><Pressable accessibilityRole="button" onPress={() => { onClose(); router.push('/places'); }} style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}><Ionicons color={theme.accent} name="add-circle-outline" size={21} /><Text style={styles.manageButtonText}>Add or manage addresses</Text><Ionicons color={theme.secondaryText} name="chevron-forward" size={19} /></Pressable></ScrollView></SafeAreaView></Modal>;
}
