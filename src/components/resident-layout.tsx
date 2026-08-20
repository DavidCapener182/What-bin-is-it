import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, type ReactNode, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appFonts, appLayout } from '@/lib/design-system';
import { type AppTheme, useAppTheme } from '@/lib/theme';
import { useAdaptiveLayout } from '@/lib/use-adaptive-layout';

type HeaderProps = {
  action?: ReactNode;
  kicker: string;
  subtitle?: string;
  title: string;
};

export function ResidentScreenHeader({ action, kicker, subtitle, title }: HeaderProps) {
  const theme = useAppTheme();
  const adaptive = useAdaptiveLayout();
  const styles = createStyles(theme);
  const horizontalPadding = adaptive.mode === 'compact'
    ? appLayout.residentCompactGutter
    : adaptive.mode === 'medium'
      ? appLayout.residentMediumGutter
      : appLayout.residentWideGutter;

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
      <View style={styles.headerCopy}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text accessibilityRole="header" style={[styles.title, adaptive.mode === 'wide' && styles.titleWide]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </SafeAreaView>
  );
}

type MasterDetailProps = {
  context?: ReactNode;
  detail: ReactNode;
  master: ReactNode;
  masterWidth?: number;
  style?: ViewStyle;
};

export function ResidentMasterDetail({
  context,
  detail,
  master,
  masterWidth = appLayout.residentMasterColumnWidth,
  style,
}: MasterDetailProps) {
  const adaptive = useAdaptiveLayout();
  const styles = StyleSheet.create({
    compact: { flex: 1, minWidth: 0 },
    columns: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'stretch' },
    master: { width: masterWidth, minWidth: 300, maxWidth: '46%' },
    detail: { flex: 1, minWidth: 0 },
    context: { width: appLayout.residentContextColumnWidth, minWidth: 280 },
  });

  if (adaptive.mode === 'compact') return <View style={[styles.compact, style]}>{master}</View>;

  return (
    <View style={[styles.columns, style]}>
      <View style={styles.master}>{master}</View>
      <View style={styles.detail}>{detail}</View>
      {context && adaptive.mode === 'wide' ? <View style={styles.context}>{context}</View> : null}
    </View>
  );
}

type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

export function InlineNotice({
  action,
  body,
  live = 'polite',
  title,
  tone = 'info',
}: {
  action?: ReactNode;
  body?: string;
  live?: 'assertive' | 'none' | 'polite';
  title: string;
  tone?: NoticeTone;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const colour = tone === 'success'
    ? theme.success
    : tone === 'warning'
      ? theme.warning
      : tone === 'danger'
        ? theme.danger
        : theme.accent;
  const icon: ComponentProps<typeof Ionicons>['name'] = tone === 'success'
    ? 'checkmark-circle-outline'
    : tone === 'warning' || tone === 'danger'
      ? 'alert-circle-outline'
      : 'information-circle-outline';

  return (
    <View
      accessibilityLiveRegion={live}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[styles.notice, { backgroundColor: `${colour}12`, borderColor: `${colour}45` }]}>
      <Ionicons color={colour} name={icon} size={21} />
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>{title}</Text>
        {body ? <Text style={styles.noticeBody}>{body}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function ResidentSearchField({
  accessibilityLabel,
  clear,
  inputRef,
  ...props
}: TextInputProps & {
  accessibilityLabel: string;
  clear?: () => void;
  inputRef?: Ref<TextInput>;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const hasValue = typeof props.value === 'string' && props.value.length > 0;

  return (
    <View style={styles.search}>
      <Ionicons color={theme.secondaryText} name="search" size={19} />
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={props.autoCorrect ?? false}
        placeholderTextColor={props.placeholderTextColor ?? theme.tertiaryText}
        ref={inputRef}
        style={[styles.searchInput, props.style]}
      />
      {hasValue && clear ? (
        <Pressable
          accessibilityLabel={`Clear ${accessibilityLabel.toLowerCase()}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={clear}
          style={styles.clearButton}>
          <Ionicons color={theme.secondaryText} name="close-circle" size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function StickyActionBar({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return <SafeAreaView edges={['bottom']} style={styles.stickyAction}><View style={styles.stickyActionInner}>{children}</View></SafeAreaView>;
}

export function ResidentEmptyState({
  action,
  body,
  icon,
  title,
}: {
  action?: ReactNode;
  body: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons color={theme.accent} name={icon} size={29} /></View>
      <Text accessibilityRole="header" style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      minHeight: 112,
      paddingTop: 12,
      paddingBottom: 20,
      backgroundColor: theme.surface,
      borderBottomColor: theme.separator,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 16,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    headerAction: { alignSelf: 'center' },
    kicker: { color: theme.accent, fontFamily: appFonts.text, fontSize: 13, fontWeight: '700' },
    title: { color: theme.text, fontFamily: appFonts.display, fontSize: 31, lineHeight: 37, fontWeight: '700', letterSpacing: -0.9, marginTop: 3 },
    titleWide: { fontSize: 36, lineHeight: 42 },
    subtitle: { color: theme.secondaryText, fontSize: 14, lineHeight: 20, marginTop: 5, maxWidth: 720 },
    notice: { minHeight: 60, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    noticeCopy: { flex: 1, minWidth: 0 },
    noticeTitle: { color: theme.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
    noticeBody: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 3 },
    search: { minHeight: 50, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface, paddingLeft: 14, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
    searchInput: { flex: 1, minWidth: 0, minHeight: 48, color: theme.text, fontSize: 16, lineHeight: 21 },
    clearButton: { width: appLayout.minimumTouchTarget, height: appLayout.minimumTouchTarget, alignItems: 'center', justifyContent: 'center' },
    stickyAction: { backgroundColor: theme.material, borderTopColor: theme.separator, borderTopWidth: StyleSheet.hairlineWidth },
    stickyActionInner: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
    empty: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface, padding: 24, alignItems: 'center' },
    emptyIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { color: theme.text, fontSize: 18, lineHeight: 23, fontWeight: '700', textAlign: 'center', marginTop: 13 },
    emptyBody: { color: theme.secondaryText, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 420, marginTop: 6 },
    emptyAction: { alignSelf: 'stretch', marginTop: 18 },
  });
}
