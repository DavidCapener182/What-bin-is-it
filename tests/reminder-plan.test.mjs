import assert from 'node:assert/strict';
import test from 'node:test';

import { planCollectionReminders } from '../src/lib/reminder-plan.ts';

const preferences = {
  enabled: true,
  reminderHour: 19,
  reminderDayOffset: 1,
  wasteTypes: {
    general: true,
    recycling: true,
    garden: false,
    food: true,
    other: true,
  },
};

test('plans the evening-before reminder from verified collection dates', () => {
  const reminders = planCollectionReminders([
    { id: 'recycling-1', date: '2026-07-28', wasteType: 'recycling', source: 'council' },
  ], preferences, new Date('2026-07-26T12:00:00+01:00'));

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].collectionId, 'recycling-1');
  assert.equal(reminders[0].triggerAt.getFullYear(), 2026);
  assert.equal(reminders[0].triggerAt.getMonth(), 6);
  assert.equal(reminders[0].triggerAt.getDate(), 27);
  assert.equal(reminders[0].triggerAt.getHours(), 19);
  assert.match(reminders[0].body, /Mixed recycling collection is tomorrow/);
});

test('omits disabled waste types, past reminders, and all reminders when disabled', () => {
  const collections = [
    { id: 'old', date: '2026-07-26', wasteType: 'general', source: 'council' },
    { id: 'garden', date: '2026-07-28', wasteType: 'garden', source: 'council' },
    { id: 'food', date: '2026-07-29', wasteType: 'food', source: 'council' },
  ];
  const now = new Date('2026-07-26T20:00:00+01:00');

  assert.deepEqual(
    planCollectionReminders(collections, preferences, now).map((item) => item.collectionId),
    ['food']
  );
  assert.deepEqual(
    planCollectionReminders(collections, { ...preferences, enabled: false }, now),
    []
  );
});

test('keeps council-specific labels in the notification copy', () => {
  const reminders = planCollectionReminders([
    {
      id: 'purple-1',
      date: '2026-07-30',
      wasteType: 'other',
      source: 'council',
      label: 'Purple-lidded bin',
    },
  ], preferences, new Date('2026-07-26T12:00:00+01:00'));

  assert.equal(reminders[0].body, 'Purple-lidded bin collection is tomorrow. Put it out before 7am.');
});

test('identifies the saved place when reminders cover multiple addresses', () => {
  const reminders = planCollectionReminders([
    {
      id: 'home:general-1',
      date: '2026-07-30',
      wasteType: 'general',
      source: 'council',
      placeLabel: 'Home',
    },
  ], preferences, new Date('2026-07-26T12:00:00+01:00'));

  assert.equal(
    reminders[0].body,
    'General waste collection for Home is tomorrow. Put it out before 7am.'
  );
});
