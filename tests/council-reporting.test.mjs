import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMissedReport,
  evaluateMissedReportEligibility,
  missedReportPolicy,
} from '../src/lib/council-reporting.ts';

const collection = {
  id: 'general-2026-07-27',
  date: '2026-07-27',
  wasteType: 'general',
  source: 'council',
  label: 'General waste bin',
};

function address(providerId) {
  return {
    id: 'home',
    label: 'Home',
    line1: '1 Test Street',
    postcode: 'M1 1AE',
    councilName: 'Test Council',
    providerId,
    councilAddressId: '1001',
    isPrimary: true,
  };
}

test('uses different official reporting windows for different councils', () => {
  const oxford = address('lad-e07000178');
  assert.equal(missedReportPolicy(oxford).eligibleHour, 16);
  assert.equal(missedReportPolicy(oxford).eligibleMinute, 30);
  assert.equal(
    evaluateMissedReportEligibility(oxford, collection, new Date('2026-07-27T16:29:00+01:00')).eligible,
    false,
  );
  assert.equal(
    evaluateMissedReportEligibility(oxford, collection, new Date('2026-07-27T16:30:00+01:00')).eligible,
    true,
  );
  assert.equal(
    evaluateMissedReportEligibility(oxford, collection).eligibleAfter.toISOString(),
    '2026-07-27T15:30:00.000Z',
  );

  const walthamForest = address('lad-e09000031');
  assert.equal(missedReportPolicy(walthamForest).eligibleHour, 22);
  assert.equal(
    evaluateMissedReportEligibility(walthamForest, collection, new Date('2026-07-27T21:59:00+01:00')).eligible,
    false,
  );

  const knowsley = address('lad-e08000011');
  assert.equal(
    evaluateMissedReportEligibility(knowsley, collection, new Date('2026-07-27T15:00:00+01:00')).eligible,
    true,
  );

  const sefton = address('lad-e08000014');
  assert.equal(
    evaluateMissedReportEligibility(sefton, collection, new Date('2026-07-28T11:59:00+01:00')).eligible,
    false,
  );
  assert.equal(
    evaluateMissedReportEligibility(sefton, collection, new Date('2026-07-28T12:00:00+01:00')).eligible,
    true,
  );

  const winterCollection = { ...collection, date: '2026-12-15' };
  assert.equal(
    evaluateMissedReportEligibility(oxford, winterCollection).eligibleAfter.toISOString(),
    '2026-12-15T16:30:00.000Z',
  );
});

test('falls back honestly when a council-specific policy is not yet encoded', () => {
  const eligibility = evaluateMissedReportEligibility(
    address('lad-unknown'),
    collection,
    new Date('2026-07-27T18:00:00+01:00'),
  );
  assert.equal(eligibility.eligible, true);
  assert.match(eligibility.reason, /official council service/);
});

test('builds a normalized local tracking record without claiming council submission', () => {
  const report = buildMissedReport(
    address('lad-e07000178'),
    collection,
    'General waste bin',
    {
      putOutOnTime: true,
      accessibleToCrew: true,
      attachedNotice: false,
      stillOutside: true,
      neighboursCollected: 'unknown',
    },
    new Date('2026-07-27T17:00:00+01:00'),
  );

  assert.equal(report.reportType, 'missed_collection');
  assert.equal(report.submissionMethod, 'council-website');
  assert.equal(report.status, 'ready');
  assert.match(report.localTrackingId, /^WB-20260727-/);
  assert.equal(report.councilReference, undefined);
  assert.equal(report.details.stillOutside, true);
  assert.match(report.officialServiceUrl, /^https:\/\/www\.oxford\.gov\.uk\//);
});
