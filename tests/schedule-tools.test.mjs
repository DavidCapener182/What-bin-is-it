import assert from 'node:assert/strict';
import test from 'node:test';

import { collectionCalendar, collectionReminderMessage } from '../src/lib/schedule-format.ts';

const address = {
  id: 'home',
  label: 'Home',
  line1: '1 Test Street',
  postcode: 'M1 1AE',
  councilName: 'Test Council',
  providerId: 'lad-e00000001',
  isPrimary: true,
};

const collections = [
  { id: 'general', date: '2026-07-31', wasteType: 'general', source: 'council', label: 'General waste bin' },
  { id: 'food', date: '2026-07-31', wasteType: 'food', source: 'council', label: 'Food waste' },
];

test('builds a household-friendly tonight sharing message', () => {
  const message = collectionReminderMessage(collections, address);
  assert.match(message, /^Bins tonight/);
  assert.match(message, /General waste bin and Food waste go out tonight/);
  assert.match(message, /Home · M1 1AE/);
});

test('exports exact verified dates without recurrence guesses', () => {
  const calendar = collectionCalendar(collections, address);
  assert.match(calendar, /DTSTART;VALUE=DATE:20260731/);
  assert.match(calendar, /General waste bin collection/);
  assert.doesNotMatch(calendar, /RRULE/);
});
