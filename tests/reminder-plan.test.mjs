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

test('uses the council presentation time when it is known', () => {
  const reminders = planCollectionReminders([
    { id: 'sefton-general', date: '2026-07-30', wasteType: 'general', source: 'council' },
  ], {
    ...preferences,
    presentationTime: '6:30 am',
  }, new Date('2026-07-26T12:00:00+01:00'));

  assert.match(reminders[0].body, /before 6:30 am/);
});

test('supports a custom reminder minute', () => {
  const reminders = planCollectionReminders([
    { id: 'custom-time', date: '2026-07-30', wasteType: 'general', source: 'council' },
  ], {
    ...preferences,
    reminderMinute: 45,
  }, new Date('2026-07-26T12:00:00+01:00'));

  assert.equal(reminders[0].triggerAt.getHours(), 19);
  assert.equal(reminders[0].triggerAt.getMinutes(), 45);
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

test('supports council-timed collection follow-up and suppresses answered collections', () => {
  const richPreferences = {
    ...preferences,
    collectionFollowUp: true,
    followUpHour: 22,
    followUpMinute: 0,
  };
  const collection = {
    id: 'home:general-1',
    date: '2026-07-27',
    wasteType: 'general',
    source: 'council',
    placeLabel: 'Home',
  };
  const reminders = planCollectionReminders(
    [collection],
    richPreferences,
    new Date('2026-07-26T12:00:00+01:00'),
  );
  const followUp = reminders.find((reminder) => reminder.title === 'Was your bin collected?');
  assert.equal(followUp.triggerAt.getHours(), 22);

  const answered = planCollectionReminders(
    [collection],
    richPreferences,
    new Date('2026-07-26T12:00:00+01:00'),
    48,
    new Set([collection.id]),
  );
  assert.equal(answered.some((reminder) => reminder.title === 'Was your bin collected?'), false);
});

test('does not send the second reminder after the bin is marked as put out', () => {
  const richPreferences = {
    ...preferences,
    secondReminder: true,
    secondReminderHour: 21,
  };
  const collection = {
    id: 'home:recycling-1',
    date: '2026-07-28',
    wasteType: 'recycling',
    source: 'council',
  };
  const reminders = planCollectionReminders(
    [collection],
    richPreferences,
    new Date('2026-07-26T12:00:00+01:00'),
    48,
    new Set(),
    new Set([collection.id]),
  );
  assert.equal(reminders.some((reminder) => reminder.title === 'Bin still to put out?'), false);
});
