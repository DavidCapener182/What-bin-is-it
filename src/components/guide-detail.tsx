import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { collectionTextColour } from '@/lib/data';
import { type CouncilProfile } from '@/lib/council-provider';
import { appFonts, appLayout } from '@/lib/design-system';
import { type GuideDestination, type GuideItem } from '@/lib/household-guide';
import { type AppTheme, useAppTheme } from '@/lib/theme';
import { type Collection } from '@/lib/types';

type Partner = NonNullable<CouncilProfile['partners']>[number];

const destinationLabel: Record<GuideDestination, string> = {
  general: 'General waste',
  recycling: 'Mixed recycling',
  garden: 'Garden waste',
  food: 'Food caddy',
  other: 'Council bin',
  service: 'Find a service',
  check: 'Check locally',
};

function destinationColour(destination: GuideDestination, theme: AppTheme) {
  if (destination === 'check') return theme.warning;
  if (destination === 'service') return theme.accent;
  return collectionTextColour(destination, theme.mode);
}

function localDestination(item: GuideItem, collections: Collection[], councilName?: string) {
  if (!['general', 'recycling', 'garden', 'food', 'other'].includes(item.destination)) {
    return councilName ? `Check ${councilName} before using a local service.` : 'Add a place for local guidance.';
  }
  const matching = collections.find((collection) => collection.wasteType === item.destination);
  if (matching) return `Your schedule calls this “${matching.label || destinationLabel[item.destination]}”.`;
  if (item.destination === 'garden' || item.destination === 'food') {
    return `${destinationLabel[item.destination]} is not currently shown in your verified schedule. Check ${councilName ?? 'your council'} before using it.`;
  }
  return `Check ${councilName ?? 'your council'} if the container name or accepted materials differ.`;
}

export function GuideDetail({
  closeAction,
  collections,
  councilName,
  findService,
  item,
  openPartner,
  partners,
  saved,
  toggleSaved,
  variant = 'panel',
}: {
  closeAction?: () => void;
  collections: Collection[];
  councilName?: string;
  findService: (item: GuideItem) => void;
  item?: GuideItem;
  openPartner: (partner: Partner, item: GuideItem) => void;
  partners?: CouncilProfile['partners'];
  saved: boolean;
  toggleSaved: () => void;
  variant?: 'page' | 'panel';
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  if (!item) {
    return (
      <View style={styles.placeholder}>
        <View style={styles.placeholderIcon}><Ionicons color={theme.accent} name="leaf-outline" size={30} /></View>
        <Text accessibilityRole="header" style={styles.placeholderTitle}>Choose an item</Text>
        <Text style={styles.placeholderBody}>Its disposal route, preparation guidance and local checks will appear here.</Text>
      </View>
    );
  }

  const colour = destinationColour(item.destination, theme);
  const body = (
    <>
      <View style={styles.header}>
        {variant === 'page' ? (
          <Pressable accessibilityLabel="Back to guide" accessibilityRole="button" onPress={closeAction ?? router.back} style={styles.headerButton}>
            <Ionicons color={theme.accent} name="chevron-back" size={23} />
          </Pressable>
        ) : null}
        <View style={[styles.icon, { backgroundColor: theme.groupedBackground }]}>
          <Ionicons color={colour} name={item.icon as keyof typeof Ionicons.glyphMap} size={25} />
        </View>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.title}>{item.name}</Text>
          <Text style={[styles.destination, { color: colour }]}>{destinationLabel[item.destination]}</Text>
        </View>
        {variant === 'panel' && closeAction ? (
          <Pressable accessibilityLabel="Close item guidance" accessibilityRole="button" onPress={closeAction} style={styles.headerButton}>
            <Ionicons color={theme.secondaryText} name="close" size={21} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: saved }} onPress={toggleSaved} style={styles.linkButton}>
          <Ionicons color={theme.accent} name={saved ? 'bookmark' : 'bookmark-outline'} size={18} />
          <Text style={styles.linkText}>{saved ? 'Saved for later' : 'Save this item'}</Text>
        </Pressable>
        <GuideSection body={item.heading} title="What to do" />
        <GuideSection body={item.detail} title="Prepare it" />
        <GuideSection
          body={item.destination === 'service'
            ? 'It needs a specialist, retailer, reuse, or council drop-off route rather than a household bin.'
            : item.destination === 'check'
              ? 'UK councils use different collection containers and sorting systems for this material.'
              : `This material is commonly handled through ${destinationLabel[item.destination].toLowerCase()}.`}
          title="Why this route"
        />
        <View style={styles.localNote}>
          <Ionicons color={theme.secondaryText} name="location-outline" size={17} />
          <Text style={styles.localNoteText}>{localDestination(item, collections, councilName)}</Text>
        </View>
        {item.destination === 'service' || item.destination === 'check' ? (
          <Pressable accessibilityRole="button" onPress={() => findService(item)} style={styles.linkButton}>
            <Ionicons color={theme.accent} name="map-outline" size={18} />
            <Text style={styles.linkText}>Find a nearby service</Text>
          </Pressable>
        ) : null}
        {partners?.length ? (
          <View style={styles.partnerGroup}>
            <Text style={styles.heading}>Partner services</Text>
            <Text style={styles.partnerPolicy}>Council and free options come first. These commercial services match this item.</Text>
            {partners.map((partner) => (
              <Pressable
                accessibilityLabel={`${partner.category === 'bulky-waste' ? 'Compare booking options for' : 'Open'} ${partner.name}, ${partner.disclosureLabel}`}
                accessibilityRole="button"
                key={partner.id}
                onPress={() => openPartner(partner, item)}
                style={styles.partnerCard}>
                <View style={styles.partnerCopy}>
                  <Text style={styles.partnerDisclosure}>{partner.disclosureLabel}</Text>
                  <Text style={styles.partnerName}>{partner.name}</Text>
                  <Text style={styles.partnerDetail}>{partner.description}</Text>
                </View>
                <Ionicons color={theme.accent} name={partner.category === 'bulky-waste' ? 'chevron-forward' : 'open-outline'} size={18} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/report-incorrect', params: { issue: 'guide-problem', detail: `Guide item: ${item.name}` } })}
          style={styles.linkButton}>
          <Ionicons color={theme.accent} name="flag-outline" size={18} />
          <Text style={styles.linkText}>Report incorrect guidance</Text>
        </Pressable>
      </ScrollView>
    </>
  );

  return variant === 'page'
    ? <SafeAreaView edges={['top', 'bottom']} style={styles.page}>{body}</SafeAreaView>
    : <View style={styles.panel}>{body}</View>;
}

function GuideSection({ body, title }: { body: ReactNode; title: string }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return <View><Text style={styles.heading}>{title}</Text><Text style={styles.detail}>{body}</Text></View>;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background },
    panel: { flex: 1, minWidth: 0, backgroundColor: theme.background, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.separator },
    header: { minHeight: 82, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
    headerButton: { width: appLayout.minimumTouchTarget, height: appLayout.minimumTouchTarget, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.groupedBackground },
    icon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1, minWidth: 0 },
    title: { color: theme.text, fontFamily: appFonts.display, fontSize: 22, lineHeight: 27, fontWeight: '700', letterSpacing: -0.35 },
    destination: { fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 3 },
    content: { padding: 20, paddingBottom: 42, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' },
    heading: { color: theme.text, fontSize: 13, lineHeight: 18, fontWeight: '800' },
    detail: { color: theme.secondaryText, fontSize: 14, lineHeight: 21, marginTop: 4 },
    localNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: theme.groupedBackground, borderRadius: 12, padding: 12 },
    localNoteText: { color: theme.secondaryText, fontSize: 13, lineHeight: 19, flex: 1, fontWeight: '600' },
    linkButton: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 },
    linkText: { color: theme.accent, fontSize: 14, lineHeight: 19, fontWeight: '700' },
    partnerGroup: { gap: 8 },
    partnerPolicy: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 18 },
    partnerCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, borderRadius: 13, backgroundColor: theme.surface },
    partnerCopy: { flex: 1, minWidth: 0 },
    partnerDisclosure: { color: theme.warning, fontSize: 12, lineHeight: 16, fontWeight: '800' },
    partnerName: { color: theme.text, fontSize: 14, lineHeight: 19, fontWeight: '800', marginTop: 3 },
    partnerDetail: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
    placeholder: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
    placeholderIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft },
    placeholderTitle: { color: theme.text, fontSize: 20, lineHeight: 25, fontWeight: '700', marginTop: 14 },
    placeholderBody: { color: theme.secondaryText, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 360, marginTop: 6 },
  });
}
