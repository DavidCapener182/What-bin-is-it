import { StyleSheet } from 'react-native';

import { appFonts } from '@/lib/design-system';
import { AppTheme } from '@/lib/theme';

export function createGuideScreenStyles(theme: AppTheme) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background },
    workspace: { flex: 1, minWidth: 0, flexDirection: 'row' },
    masterPane: { width: 430, minWidth: 320, maxWidth: '48%', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.separator },
    masterPaneCompact: { width: '100%', maxWidth: '100%', borderRightWidth: 0 },
    guideContent: { paddingBottom: 120, backgroundColor: theme.background },
    listHeader: { padding: 18, gap: 14 },
    servicesContent: { padding: 18, paddingBottom: 120, gap: 14, width: '100%', maxWidth: 980, alignSelf: 'center' },
    sourceLink: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', margin: -8 },
    hiddenPanel: { display: 'none' },
    searchBox: { height: 51, borderRadius: 16, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, paddingHorizontal: 14, alignItems: 'center', flexDirection: 'row', gap: 9 },
    guidanceSource: { minHeight: 68, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
    guidanceSourceCopy: { flex: 1 },
    guidanceSourceTitle: { color: theme.text, fontSize: 12.5, lineHeight: 17, fontWeight: '700' },
    guidanceSourceDetail: { color: theme.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 2 },
    input: { color: theme.text, fontSize: 14, fontWeight: '600', flex: 1, height: '100%' },
    chips: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: -5 },
    chipsLabel: { color: theme.secondaryText, fontSize: 12, letterSpacing: 0.25, fontWeight: '700', marginRight: 2 },
    chip: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 14, backgroundColor: theme.accentSoft },
    chipText: { color: theme.accent, fontSize: 12, fontWeight: '800' },
    recentChip: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface },
    recentChipText: { color: theme.text, fontSize: 12, fontWeight: '700' },
    savedChipActive: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    savedChipText: { color: theme.accent },
    guideHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
    sectionKicker: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.85, fontWeight: '700' },
    sectionTitle: { color: theme.text, fontFamily: appFonts.display, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.45, marginTop: 2 },
    checkPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, backgroundColor: `${theme.warning}14` },
    checkText: { color: theme.warning, fontSize: 12, fontWeight: '700' },
    empty: { borderRadius: 18, padding: 23, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.separator, alignItems: 'center' },
    emptyTitle: { color: theme.text, fontSize: 13.5, fontWeight: '700', marginTop: 8 },
    emptyText: { color: theme.secondaryText, fontSize: 13, textAlign: 'center', lineHeight: 18, marginTop: 4, maxWidth: 270 },
  });
}
