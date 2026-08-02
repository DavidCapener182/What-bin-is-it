import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseBulkyBookingStart, parseBulkyBookingStatus } from '../server/lib/bulky-booking-validation.ts';

const installationId = '123e4567-e89b-42d3-a456-426614174000';

test('accepts a bounded pseudonymous bulky booking request', () => {
  assert.deepEqual(parseBulkyBookingStart({
    installationId,
    councilProviderId: 'lad-e08000011',
    itemKey: 'mattress',
    quantity: 2,
  }), {
    installationId,
    councilProviderId: 'lad-e08000011',
    itemKey: 'mattress',
    quantity: 2,
    partnerId: undefined,
  });
});

test('rejects contact, address and unbounded quantity fields', () => {
  assert.throws(() => parseBulkyBookingStart({
    installationId,
    councilProviderId: 'lad-e08000011',
    itemKey: 'mattress',
    quantity: 1,
    postcode: 'L36 7XA',
  }), /invalid field/);
  assert.throws(() => parseBulkyBookingStart({
    installationId,
    councilProviderId: 'lad-e08000011',
    itemKey: 'mattress',
    quantity: 21,
  }), /between 1 and 20/);
});

test('scopes booking status to the public reference and local installation', () => {
  assert.deepEqual(
    parseBulkyBookingStatus(new URL(`https://example.test/status?reference=WB-ABCDEF123456&installationId=${installationId}`)),
    { reference: 'WB-ABCDEF123456', installationId },
  );
  assert.throws(
    () => parseBulkyBookingStatus(new URL('https://example.test/status?reference=WB-ABCDEF123456')),
    /installation reference/,
  );
});

test('the database ledger is Bin-prefixed, private and excludes resident contact fields', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/20260802083151_bulky_booking_marketplace.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /create table if not exists public\.bin_bulky_bookings/);
  assert.match(migration, /alter table public\.bin_bulky_bookings enable row level security/);
  assert.match(migration, /revoke all on table public\.bin_bulky_bookings from anon, authenticated/);
  assert.doesNotMatch(
    migration,
    /\b(resident_name|resident_email|telephone|phone_number|postcode|street_address|uprn)\b\s+(?:varchar|text)/i,
  );
});

test('paid bulky collections hold provider funds until collection completion', async () => {
  const [migration, server, residentScreen] = await Promise.all([
    readFile(new URL('../supabase/migrations/20260802131152_sponsored_bulky_marketplace.sql', import.meta.url), 'utf8'),
    readFile(new URL('../server/lib/bulky-bookings.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/bulky-booking.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(migration, /create table if not exists public\.bin_bulky_booking_events/);
  assert.match(migration, /'awaiting-provider'/);
  assert.match(migration, /stripe_transfer_id/);
  assert.match(migration, /revoke all on table public\.bin_bulky_booking_events from anon, authenticated/);
  assert.match(server, /transfer_group: reference/);
  assert.doesNotMatch(server, /transfer_data\s*:/);
  assert.match(server, /FOR UPDATE/);
  assert.match(server, /'awaiting-provider' AND status IN \('started', 'checkout-created', 'payment-pending', 'payment-failed'\)/);
  assert.match(residentScreen, /SPONSORED PAID COLLECTION/);
  assert.match(residentScreen, /We confirm the collector and release their payout after collection/);
  assert.match(residentScreen, /Refresh status/);
});
