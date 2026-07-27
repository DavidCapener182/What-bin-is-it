import { findCouncilByProviderId } from '../../src/lib/council-directory.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const councilIdPattern = /^lad-[ensw][0-9]{8}$/;

export type PilotCouncilLinkSync = {
  participantId: string;
  consentVersion: '2026-07-27';
  councilIds: string[];
};

export function isPilotParticipantId(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

export function councilWorkspaceForResidentUse(councilId: string) {
  const council = findCouncilByProviderId(councilId);
  if (!council) return undefined;
  const nameSlug = council.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 75);
  return {
    providerId: council.providerId,
    slug: `${nameSlug}-${council.providerId.slice(-4)}`,
    name: council.name,
  };
}

export function parsePilotCouncilLinkSync(value: unknown): PilotCouncilLinkSync {
  if (!value || typeof value !== 'object') {
    throw new Error('A council link update is required.');
  }
  const raw = value as Record<string, unknown>;
  const allowedKeys = new Set(['participantId', 'consentVersion', 'councilIds']);
  if (
    Object.keys(raw).some((key) => !allowedKeys.has(key))
    || !isPilotParticipantId(raw.participantId)
    || raw.consentVersion !== '2026-07-27'
    || !Array.isArray(raw.councilIds)
    || raw.councilIds.length > 10
    || raw.councilIds.some((councilId) => (
      typeof councilId !== 'string'
      || !councilIdPattern.test(councilId)
      || !councilWorkspaceForResidentUse(councilId)
    ))
  ) {
    throw new Error('The council link update is invalid.');
  }
  return {
    participantId: raw.participantId,
    consentVersion: '2026-07-27',
    councilIds: [...new Set(raw.councilIds as string[])].sort(),
  };
}
