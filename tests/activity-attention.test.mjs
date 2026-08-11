import assert from 'node:assert/strict';
import test from 'node:test';

import { activityHistoryForFilter, reportNeedsResidentAttention, supportReplyNeedsAttention } from '../src/lib/activity-attention.ts';

test('keeps resident-action report states actionable and clears terminal states', () => {
  assert.equal(reportNeedsResidentAttention({ status: 'draft' }, 'draft'), true);
  assert.equal(reportNeedsResidentAttention({ status: 'ready' }, 'ready'), true);
  assert.equal(reportNeedsResidentAttention({ status: 'resolved' }), false);
  assert.equal(reportNeedsResidentAttention({ status: 'closed' }), false);
});

test('shows a changed council report state once until the resident opens it', () => {
  assert.equal(reportNeedsResidentAttention({ status: 'acknowledged' }), true);
  assert.equal(reportNeedsResidentAttention({ status: 'acknowledged' }, 'acknowledged'), false);
  assert.equal(reportNeedsResidentAttention({ status: 'recollection-scheduled' }, 'acknowledged'), true);
});

test('counts only an unseen support reply that is waiting for the resident', () => {
  const thread = {
    id: 'thread-1',
    status: 'waiting-resident',
    lastSender: 'support',
    messages: [{ id: 'resident-1' }, { id: 'support-2' }],
  };
  assert.equal(supportReplyNeedsAttention(thread), true);
  assert.equal(supportReplyNeedsAttention(thread, 'support-2'), false);
  assert.equal(supportReplyNeedsAttention({ ...thread, lastSender: 'resident' }), false);
  assert.equal(supportReplyNeedsAttention({ ...thread, status: 'resolved' }), false);
});

test('filters the complete Activity history by selected section and place', () => {
  const entries = [
    { id: 'collection', type: 'collection-confirmed', title: 'Collected', occurredAt: '2026-08-10T10:00:00Z', addressId: 'home' },
    { id: 'report', type: 'report-updated', title: 'Report updated', occurredAt: '2026-08-10T11:00:00Z', addressId: 'home' },
    { id: 'other-report', type: 'report-opened', title: 'Other report', occurredAt: '2026-08-10T12:00:00Z', addressId: 'other' },
  ];

  assert.deepEqual(activityHistoryForFilter(entries, 'all', 'home').map(({ id }) => id), ['collection', 'report']);
  assert.deepEqual(activityHistoryForFilter(entries, 'reports', 'home').map(({ id }) => id), ['report']);
  assert.deepEqual(activityHistoryForFilter(entries, 'council', 'home'), []);
  assert.deepEqual(activityHistoryForFilter(entries, 'support', 'home'), []);
});
