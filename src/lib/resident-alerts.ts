import type { CouncilAudienceCriteria, CouncilProfile } from '@/lib/council-provider';
import type { Collection } from '@/lib/types';

export type ResidentAlert = {
  id: string;
  providerId: string;
  councilName: string;
  kind: 'announcement' | 'disruption';
  severity: 'information' | 'warning' | 'critical';
  title: string;
  body: string;
  startsAt?: string;
  endsAt?: string;
  sourceUrl?: string;
  deepLink: '/' | '/schedule' | '/guide' | '/activity';
};

function isCurrent(startsAt: string | undefined, endsAt: string | undefined, now: Date) {
  const starts = startsAt ? new Date(startsAt) : undefined;
  const ends = endsAt ? new Date(endsAt) : undefined;
  return (!starts || !Number.isFinite(starts.getTime()) || starts <= now)
    && (!ends || !Number.isFinite(ends.getTime()) || ends > now);
}

function matchesAudience(
  audience: CouncilAudienceCriteria | undefined,
  collections: Collection[],
  audienceLabels: string[],
) {
  if (!audience || audience.scope === 'council') return true;
  const collectionTypes = new Set(collections.map((collection) => collection.wasteType));
  const collectionDates = new Set(collections.map((collection) => collection.date));
  const residentLabels = new Set(audienceLabels.map((label) => label.trim().toLowerCase()).filter(Boolean));
  const matchesTypes = !audience.collectionTypes.length
    || audience.collectionTypes.some((type) => collectionTypes.has(type));
  const matchesDates = !audience.collectionDates.length
    || audience.collectionDates.some((date) => collectionDates.has(date));
  const matchesLabels = !audience.audienceLabels.length
    || audience.audienceLabels.some((label) => residentLabels.has(label.trim().toLowerCase()));
  return matchesTypes && matchesDates && matchesLabels;
}

export function residentAlertsForProfile(
  profile: CouncilProfile | undefined,
  collections: Collection[] = [],
  audienceLabels: string[] = [],
  now = new Date(),
): ResidentAlert[] {
  if (!profile) return [];
  const councilName = profile.branding?.displayName ?? profile.councilName ?? 'Your council';
  const announcements: ResidentAlert[] = (profile.announcements ?? [])
    .filter((item) => isCurrent(item.startsAt, item.endsAt, now) && matchesAudience(item.audience, collections, audienceLabels))
    .map((item) => ({
      id: `${profile.providerId}:announcement:${item.id}`,
      providerId: profile.providerId,
      councilName,
      kind: 'announcement',
      severity: item.severity === 'critical' ? 'critical' : item.severity === 'warning' ? 'warning' : 'information',
      title: item.title,
      body: item.body,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      sourceUrl: item.sourceUrl,
      deepLink: item.placements.includes('schedule')
          ? '/schedule'
          : item.placements.includes('guide')
            ? '/guide'
            : item.placements.includes('activity')
              ? '/activity'
              : '/',
    }));
  const disruptions: ResidentAlert[] = (profile.disruptions ?? [])
    .filter((item) => isCurrent(item.startsAt, item.endsAt, now) && matchesAudience(item.audience, collections, audienceLabels))
    .map((item) => ({
      id: `${profile.providerId}:disruption:${item.id}`,
      providerId: profile.providerId,
      councilName,
      kind: 'disruption',
      severity: 'critical',
      title: item.title,
      body: item.residentInstruction || item.detail,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      sourceUrl: item.sourceUrl,
      deepLink: '/schedule',
    }));
  const order = { critical: 0, warning: 1, information: 2 };
  return [...disruptions, ...announcements].sort((left, right) => {
    if (left.severity === right.severity) return (right.startsAt ?? '').localeCompare(left.startsAt ?? '');
    return order[left.severity] - order[right.severity];
  });
}
