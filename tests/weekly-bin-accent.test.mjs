import assert from 'node:assert/strict';
import test from 'node:test';

import { colourWithAlpha, nextWeeklyBinAccent } from '../src/lib/weekly-bin-accent.ts';

const now = new Date('2026-07-27T12:00:00');

function collection(id, date, wasteType, label, colour) {
  return {
    id,
    date,
    wasteType,
    source: 'council',
    ...(label ? { label } : {}),
    ...(colour ? { colour } : {}),
  };
}

test('uses the next main source-backed bin as a subtle weekly accent', () => {
  const accent = nextWeeklyBinAccent([
    collection('food', '2026-07-31', 'food', 'Food waste caddy'),
    collection('general', '2026-07-31', 'general', 'Maroon general waste bin', '#7A263A'),
    collection('recycling', '2026-08-07', 'recycling', 'Grey recycling bin', '#6F777D'),
  ], now);

  assert.equal(accent?.colour, '#7A263A');
  assert.equal(accent?.label, 'Maroon general waste bin');
  assert.equal(accent?.cue, 'Maroon bin this week');
});

test('does not invent a weekly colour when the council source did not provide one', () => {
  const accent = nextWeeklyBinAccent([
    collection('general', '2026-07-31', 'general', 'General waste'),
  ], now);

  assert.equal(accent, undefined);
});

test('keeps tint generation bounded and deterministic', () => {
  assert.equal(colourWithAlpha('#7A263A', 0.11), 'rgba(122,38,58,0.11)');
  assert.equal(colourWithAlpha('#7A263A', 2), 'rgba(122,38,58,1)');
});
