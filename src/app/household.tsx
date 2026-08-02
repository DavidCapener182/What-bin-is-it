import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { collectionDisplayMeta, dayDifference, formatCollectionDate, sortCollections } from '@/lib/data';
import { useAppTheme } from '@/lib/theme';
import { useAccount } from '@/lib/use-account';
import { useAppData } from '@/lib/use-app-data';
import { useHouseholdSharing } from '@/lib/use-household-sharing';
import { useSubscription } from '@/lib/use-subscription';

export default function HouseholdScreen() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const params = useLocalSearchParams<{ invite?: string }>();
  const { activeAddress, collections } = useAppData();
  const account = useAccount();
  const subscription = useSubscription();
  const householdState = useHouseholdSharing();
  const [displayName, setDisplayName] = useState('Home household');
  const [memberName, setMemberName] = useState(account.user?.email?.split('@')[0] ?? 'Me');
  const [inviteToken, setInviteToken] = useState('');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const household = householdState.households.find((item) => item.councilProviderId === activeAddress?.providerId)
    ?? householdState.households[0];
  const next = sortCollections(collections).find((collection) => dayDifference(collection.date) >= 0);
  const nextCollections = next ? collections.filter((collection) => collection.date === next.date) : [];
  const joinToken = typeof params.invite === 'string' ? params.invite : inviteToken;

  const latestAssignments = useMemo(() => household?.actions.filter((action) => action.action === 'assigned') ?? [], [household]);

  async function perform(task: () => Promise<unknown>, success: string) {
    setBusy(true); setError(undefined); setMessage(undefined);
    try { await task(); setMessage(success); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The household could not be updated.'); }
    finally { setBusy(false); }
  }

  async function shareInvite() {
    if (!household) return;
    await perform(async () => {
      const invite = await householdState.invite(household.id);
      if (!invite) throw new Error('The invite could not be created.');
      const url = Platform.OS === 'web'
        ? `${globalThis.location?.origin ?? 'https://what-bin-is-it-tonight.vercel.app'}/household?invite=${encodeURIComponent(invite.token)}`
        : Linking.createURL('/household', { queryParams: { invite: invite.token } });
      if (Platform.OS === 'web') await Clipboard.setStringAsync(url);
      else await Share.share({ title: 'Join my What Bin household', message: `Join ${household.displayName} in What Bin: ${url}` });
    }, Platform.OS === 'web' ? 'Invite link copied. It expires in seven days.' : 'Invite ready to share.');
  }

  if (!subscription.isPlus) {
    return <AppShell activeRoute="/settings"><RouteHead title="Household Sharing" description="Coordinate bin night with your household." path="/household" /><View style={[styles.center, { backgroundColor: theme.background }]}><Ionicons color={theme.accent} name="people-outline" size={42} /><Text style={styles.centerTitle}>Household sharing</Text><Text style={styles.centerBody}>Share bin responsibility and collection status with your household. Addresses stay on each person’s device.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/plus')} style={styles.primary}><Text style={styles.primaryText}>See What Bin Plus</Text></Pressable></View></AppShell>;
  }

  if (!householdState.signedIn) {
    return <AppShell activeRoute="/settings"><RouteHead title="Household Sharing" description="Sign in to coordinate bin night with your household." path="/household" /><View style={[styles.center, { backgroundColor: theme.background }]}><Ionicons color={theme.accent} name="person-circle-outline" size={42} /><Text style={styles.centerTitle}>Sign in to share a household</Text><Text style={styles.centerBody}>Only a household nickname, council and explicit bin actions are shared. Your saved address stays on this device.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={styles.primary}><Text style={styles.primaryText}>Sign in</Text></Pressable></View></AppShell>;
  }

  return <AppShell activeRoute="/settings">
    <RouteHead title="Household Sharing" description="Coordinate verified collection responsibilities without uploading your address." path="/household" />
    <View style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons color={theme.accent} name="chevron-back" size={25} /></Pressable><View><Text style={styles.kicker}>What Bin Plus</Text><Text style={styles.title}>Household</Text></View></SafeAreaView>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.privacy}><Ionicons color={theme.success} name="shield-checkmark-outline" size={22} /><Text style={styles.privacyText}>Opt in only. No address, postcode or council property reference is uploaded.</Text></View>
        {householdState.loading ? <ActivityIndicator color={theme.accent} /> : null}
        {!household ? <View style={styles.card}><Text style={styles.cardTitle}>{joinToken ? 'Join this household' : 'Create your household'}</Text><Text style={styles.cardBody}>{joinToken ? 'Choose the name other members will see.' : 'Use a friendly nickname. Your exact collection place remains local.'}</Text>{!joinToken ? <TextInput accessibilityLabel="Household name" maxLength={80} onChangeText={setDisplayName} placeholder="Home household" placeholderTextColor={theme.tertiaryText} style={styles.input} value={displayName} /> : null}<TextInput accessibilityLabel="Your household name" maxLength={60} onChangeText={setMemberName} placeholder="Your first name" placeholderTextColor={theme.tertiaryText} style={styles.input} value={memberName} />{!joinToken && !activeAddress ? <Text style={styles.error}>Add an address before creating a household.</Text> : null}<Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || (!joinToken && !activeAddress) }} disabled={busy || (!joinToken && !activeAddress)} onPress={() => void perform(() => joinToken ? householdState.join(joinToken, memberName) : householdState.create({ councilProviderId: activeAddress!.providerId, displayName, memberName }), joinToken ? 'Household joined.' : 'Household created.')} style={[styles.primary, (busy || (!joinToken && !activeAddress)) && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{joinToken ? 'Join household' : 'Create household'}</Text>}</Pressable>{!params.invite && !activeAddress ? <><Text style={styles.or}>or</Text><TextInput accessibilityLabel="Household invite token" autoCapitalize="none" onChangeText={setInviteToken} placeholder="Paste an invite token" placeholderTextColor={theme.tertiaryText} style={styles.input} value={inviteToken} /></> : null}</View> : <>
          <View style={styles.hero}><View><Text style={styles.heroKicker}>{household.role === 'owner' ? 'YOUR HOUSEHOLD' : 'SHARED HOUSEHOLD'}</Text><Text style={styles.heroTitle}>{household.displayName}</Text><Text style={styles.heroBody}>{activeAddress?.councilName ?? 'Council-linked collection coordination'}</Text></View><Ionicons color="#FFFFFF" name="people" size={32} /></View>
          {next ? <View style={styles.card}><Text style={styles.cardKicker}>NEXT COLLECTION</Text><Text style={styles.cardTitle}>{formatCollectionDate(next.date, 'weekday')}</Text>{nextCollections.map((collection) => { const meta = collectionDisplayMeta(collection); const assignment = latestAssignments.find((action) => action.collectionDate === collection.date && action.wasteType === collection.wasteType); const assigned = household.members.find((member) => member.id === assignment?.responsibleUserId); return <View key={collection.id} style={styles.collection}><View style={[styles.dot, { backgroundColor: meta.colour }]} /><View style={styles.collectionCopy}><Text style={styles.memberName}>{meta.label}</Text><Text style={styles.cardBody}>{assigned ? `${assigned.displayName} is putting it out` : 'Anyone can take responsibility'}</Text></View></View>; })}<Text style={styles.assignTitle}>Who is putting it out?</Text><View style={styles.people}>{household.members.map((member) => <Pressable accessibilityRole="button" key={member.id} onPress={() => void perform(async () => { for (const collection of nextCollections) await householdState.recordAction({ householdId: household.id, collectionDate: collection.date, wasteType: collection.wasteType, action: 'assigned', responsibleUserId: member.id }); }, `${member.displayName} is assigned.`)} style={styles.person}><Ionicons color={theme.accent} name="person-circle-outline" size={22} /><Text style={styles.personText}>{member.displayName}</Text></Pressable>)}</View></View> : null}
          <View style={styles.card}><View style={styles.rowBetween}><View><Text style={styles.cardKicker}>MEMBERS</Text><Text style={styles.cardTitle}>{household.members.length} people</Text></View>{household.role === 'owner' ? <Pressable accessibilityRole="button" onPress={() => void shareInvite()} style={styles.smallButton}><Ionicons color={theme.accent} name="share-outline" size={18} /><Text style={styles.smallButtonText}>Invite</Text></Pressable> : null}</View>{household.members.map((member) => <View key={member.id} style={styles.memberRow}><Ionicons color={theme.accent} name="person-circle-outline" size={25} /><View><Text style={styles.memberName}>{member.displayName}</Text><Text style={styles.cardBody}>{member.role === 'owner' ? 'Household owner' : 'Member'}</Text></View></View>)}</View>
          <View style={styles.card}><Text style={styles.cardKicker}>RECENT</Text><Text style={styles.cardTitle}>Household activity</Text>{household.actions.slice(0, 8).map((action) => { const actor = household.members.find((member) => member.id === action.actorUserId); const responsible = household.members.find((member) => member.id === action.responsibleUserId); return <View key={action.id} style={styles.activityRow}><Ionicons color={theme.accent} name={action.action === 'assigned' ? 'person-add-outline' : 'checkmark-circle-outline'} size={20} /><Text style={styles.activityText}>{action.action === 'assigned' ? `${actor?.displayName ?? 'A member'} assigned ${responsible?.displayName ?? 'someone'}` : `${actor?.displayName ?? 'A member'} marked ${action.wasteType} ${action.action.replace('-', ' ')}`}</Text></View>; })}{!household.actions.length ? <Text style={styles.cardBody}>No household actions yet.</Text> : null}</View>
        </>}
        {error || householdState.error ? <Text accessibilityRole="alert" style={styles.error}>{error ?? householdState.error}</Text> : null}
        {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
      </ScrollView>
    </View>
  </AppShell>;
}

function createStyles(theme: ReturnType<typeof useAppTheme>) { return StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background }, header: { minHeight: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface, borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }, back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, kicker: { color: theme.accent, fontSize: 13, fontWeight: '700' }, title: { color: theme.text, fontSize: 30, lineHeight: 35, fontWeight: '700' }, content: { padding: 16, paddingBottom: 120, gap: 16 }, privacy: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: theme.accentSoft, borderRadius: 14 }, privacyText: { color: theme.text, flex: 1, fontSize: 14, lineHeight: 19 }, card: { backgroundColor: theme.surface, borderColor: theme.separator, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, gap: 12 }, cardKicker: { color: theme.secondaryText, fontSize: 12, fontWeight: '700', letterSpacing: 0.7 }, cardTitle: { color: theme.text, fontSize: 22, lineHeight: 27, fontWeight: '700' }, cardBody: { color: theme.secondaryText, fontSize: 14, lineHeight: 20 }, input: { minHeight: 50, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.background, color: theme.text, paddingHorizontal: 14, fontSize: 16 }, primary: { minHeight: 50, borderRadius: 13, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }, disabled: { opacity: 0.45 }, hero: { backgroundColor: theme.hero, borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, heroKicker: { color: theme.heroSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }, heroTitle: { color: theme.heroText, fontSize: 28, fontWeight: '700', marginTop: 5 }, heroBody: { color: theme.heroSecondary, fontSize: 14, marginTop: 4 }, collection: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }, dot: { width: 12, height: 12, borderRadius: 6 }, collectionCopy: { flex: 1 }, assignTitle: { color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 4 }, people: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, person: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 11, borderColor: theme.separator, borderWidth: StyleSheet.hairlineWidth, backgroundColor: theme.accentSoft }, personText: { color: theme.accent, fontWeight: '700' }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, smallButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.accentSoft }, smallButtonText: { color: theme.accent, fontWeight: '700' }, memberRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 }, memberName: { color: theme.text, fontSize: 16, fontWeight: '700' }, activityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }, activityText: { color: theme.text, flex: 1, fontSize: 14, lineHeight: 19 }, error: { color: theme.danger, fontSize: 14, lineHeight: 19 }, success: { color: theme.success, fontSize: 14, lineHeight: 19 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }, centerTitle: { color: theme.text, fontSize: 26, fontWeight: '700', textAlign: 'center' }, centerBody: { color: theme.secondaryText, fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 420 }, or: { color: theme.secondaryText, textAlign: 'center' },
}); }
