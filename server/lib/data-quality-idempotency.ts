import { createHash } from 'node:crypto';

import type { ValidatedDataQualityReport } from './data-quality-validation';

type DataQualityReplayIdentity = {
  clientIdHash: string;
  payloadDigest: string;
};

export function dataQualityPayloadDigest(input: ValidatedDataQualityReport) {
  // The request and client IDs are idempotency/rate-limit identities rather than
  // report content. Council name is server-derived and may change independently.
  const canonicalPayload = {
    issue: input.issue,
    detail: input.detail,
    expectedValue: input.expectedValue ?? null,
    councilProviderId: input.councilProviderId ?? null,
    displayedCollectionDate: input.displayedCollectionDate ?? null,
    lastVerifiedAt: input.lastVerifiedAt ?? null,
    appVersion: input.appVersion,
    online: input.online,
  };
  return createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
}

export function dataQualityReplayMatches(
  stored: DataQualityReplayIdentity,
  current: DataQualityReplayIdentity,
) {
  return (
    stored.clientIdHash === current.clientIdHash
    && stored.payloadDigest === current.payloadDigest
  );
}
