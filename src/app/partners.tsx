import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import {
  CommercialPlan,
  councilPlans,
  propertyPlans,
} from '@/lib/commercial-offer';
import { appFonts } from '@/lib/design-system';
import { useAppTheme } from '@/lib/theme';

function Price({ plan }: { plan: CommercialPlan }) {
  const theme = useAppTheme();
  const cadence = plan.cadence === 'quote'
    ? ''
    : plan.cadence === 'one-time'
      ? ' once'
      : ` / ${plan.cadence === 'yearly' ? 'year' : 'month'}`;
  return (
    <Text style={[styles.price, { color: theme.text }]}>
      {plan.price}<Text style={[styles.cadence, { color: theme.secondaryText }]}>{cadence}</Text>
    </Text>
  );
}

function PlanCard({ plan }: { plan: CommercialPlan }) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.planCard,
        {
          backgroundColor: theme.surface,
          borderColor: plan.recommended ? theme.accent : theme.separator,
        },
      ]}>
      <View style={styles.planHeading}>
        <View style={styles.planCopy}>
          <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
          <Price plan={plan} />
        </View>
        {plan.recommended ? (
          <View style={[styles.recommended, { backgroundColor: theme.accentSoft }]}>
            <Text style={[styles.recommendedText, { color: theme.accent }]}>Best pilot fit</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.planDescription, { color: theme.secondaryText }]}>{plan.description}</Text>
      <View style={styles.featureList}>
        {plan.features.map((feature) => (
          <View key={feature} style={styles.feature}>
            <Ionicons color={theme.accent} name="checkmark-circle" size={19} />
            <Text style={[styles.featureText, { color: theme.text }]}>{feature}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function PartnersScreen() {
  const theme = useAppTheme();
  const partnershipEmail = process.env.EXPO_PUBLIC_PARTNERSHIP_EMAIL?.trim();

  function contact() {
    if (!partnershipEmail) return;
    const subject = encodeURIComponent('What Bin Is It Tonight? partnership enquiry');
    const body = encodeURIComponent([
      'Organisation:',
      'Council or portfolio size:',
      'Current collection-data source:',
      'What we would like to improve:',
    ].join('\n'));
    void Linking.openURL(`mailto:${partnershipEmail}?subject=${subject}&body=${body}`);
  }

  return (
    <AppShell activeRoute="/partners">
      <RouteHead
        title="Council and Property Partnerships"
        description="Pilot What Bin Is It Tonight? with a council, housing provider or property portfolio."
        path="/partners"
      />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView
          edges={['top']}
          style={[styles.header, { backgroundColor: theme.material, borderBottomColor: theme.separator }]}>
          <Pressable
            accessibilityLabel="Close partnerships"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.close}>
            <Ionicons color={theme.accent} name="close" size={24} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Partnerships</Text>
          <View style={styles.close} />
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: theme.hero }]}>
            <Text style={[styles.eyebrow, { color: theme.accent }]}>WHAT BIN? FOR ORGANISATIONS</Text>
            <Text style={[styles.title, { color: theme.heroText }]}>Fewer avoidable calls. Clearer recycling. Easier reporting.</Text>
            <Text style={[styles.intro, { color: theme.heroSecondary }]}>
              A resident-first collection utility that can use an approved council feed, publish disruption updates and guide people to the right local service.
            </Text>
            <View style={styles.heroProof}>
              {['No adverts', 'No address-data sales', 'Exact property selection'].map((item) => (
                <View key={item} style={styles.proofPill}>
                  <Text style={[styles.proofText, { color: theme.heroText }]}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.kicker, { color: theme.secondaryText }]}>COUNCILS</Text>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Start with one measurable pilot</Text>
            <Text style={[styles.sectionBody, { color: theme.secondaryText }]}>
              Agree a service area, connect the council’s approved collection source, set success measures and run a resident pilot before a wider commitment.
            </Text>
            {councilPlans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
            <View style={[styles.feeNote, { backgroundColor: theme.groupedBackground }]}>
              <Ionicons color={theme.accent} name="construct-outline" size={21} />
              <Text style={[styles.feeNoteText, { color: theme.secondaryText }]}>
                Onboarding is scoped separately at £3,000–£10,000 depending on data and CRM integration.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.kicker, { color: theme.secondaryText }]}>PROPERTY TEAMS</Text>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>One view across a portfolio</Text>
            <Text style={[styles.sectionBody, { color: theme.secondaryText }]}>
              Designed for communal collections, caretaker tasks, resident sharing, recurring failures and property-specific instructions.
            </Text>
            {propertyPlans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
          </View>

          <View style={[styles.trustCard, { backgroundColor: theme.accentSoft }]}>
            <Ionicons color={theme.accent} name="shield-checkmark" size={28} />
            <View style={styles.trustCopy}>
              <Text style={[styles.trustTitle, { color: theme.text }]}>The resident utility stays trusted</Text>
              <Text style={[styles.trustBody, { color: theme.secondaryText }]}>
                Essential collection information and the basic missed-bin route stay free. Paid local services can never outrank a free council or charity option.
              </Text>
            </View>
          </View>

          {partnershipEmail ? (
            <Pressable
              accessibilityRole="button"
              onPress={contact}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: theme.accent },
                pressed && styles.pressed,
              ]}>
              <Ionicons color="#FFFFFF" name="mail" size={20} />
              <Text style={styles.ctaText}>Discuss a pilot</Text>
            </Pressable>
          ) : (
            <View style={[styles.contactPending, { borderColor: theme.separator }]}>
              <Text style={[styles.contactPendingTitle, { color: theme.text }]}>Pilot contact is being prepared</Text>
              <Text style={[styles.contactPendingBody, { color: theme.secondaryText }]}>
                Council outreach is managed directly during the first pilot phase.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: appFonts.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  content: { paddingBottom: 112 },
  hero: { paddingHorizontal: 22, paddingTop: 30, paddingBottom: 28, gap: 13 },
  eyebrow: { fontFamily: appFonts.text, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontFamily: appFonts.display, fontSize: 36, lineHeight: 40, fontWeight: '800', letterSpacing: -1.3, maxWidth: 470 },
  intro: { fontFamily: appFonts.text, fontSize: 17, lineHeight: 24, maxWidth: 480 },
  heroProof: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  proofPill: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    paddingHorizontal: 11,
    justifyContent: 'center',
  },
  proofText: { fontFamily: appFonts.text, fontSize: 12, fontWeight: '700' },
  section: { paddingHorizontal: 18, paddingTop: 30, gap: 12 },
  kicker: { fontFamily: appFonts.text, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1.4 },
  sectionTitle: { fontFamily: appFonts.display, fontSize: 29, lineHeight: 34, fontWeight: '700', letterSpacing: -0.9 },
  sectionBody: { fontFamily: appFonts.text, fontSize: 15, lineHeight: 22, marginBottom: 2 },
  planCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 17, gap: 11 },
  planHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  planCopy: { flex: 1, gap: 4 },
  planName: { fontFamily: appFonts.text, fontSize: 18, lineHeight: 22, fontWeight: '700' },
  price: { fontFamily: appFonts.display, fontSize: 25, lineHeight: 30, fontWeight: '800', letterSpacing: -0.7 },
  cadence: { fontFamily: appFonts.text, fontSize: 13, fontWeight: '500', letterSpacing: 0 },
  recommended: { minHeight: 28, borderRadius: 14, paddingHorizontal: 10, justifyContent: 'center' },
  recommendedText: { fontFamily: appFonts.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  planDescription: { fontFamily: appFonts.text, fontSize: 14, lineHeight: 20 },
  featureList: { gap: 8 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureText: { flex: 1, fontFamily: appFonts.text, fontSize: 14, lineHeight: 19, fontWeight: '500' },
  feeNote: { borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  feeNoteText: { flex: 1, fontFamily: appFonts.text, fontSize: 13, lineHeight: 19 },
  trustCard: { marginHorizontal: 18, marginTop: 30, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  trustCopy: { flex: 1, gap: 5 },
  trustTitle: { fontFamily: appFonts.text, fontSize: 17, lineHeight: 21, fontWeight: '700' },
  trustBody: { fontFamily: appFonts.text, fontSize: 14, lineHeight: 20 },
  cta: { marginHorizontal: 18, marginTop: 18, minHeight: 54, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  ctaText: { color: '#FFFFFF', fontFamily: appFonts.text, fontSize: 16, fontWeight: '700' },
  contactPending: { marginHorizontal: 18, marginTop: 18, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 4 },
  contactPendingTitle: { fontFamily: appFonts.text, fontSize: 15, fontWeight: '700' },
  contactPendingBody: { fontFamily: appFonts.text, fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
});
