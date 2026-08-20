import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routes = [
  ['analytics/events.post.ts', 'parsePilotAnalyticsBatch', 'savePilotAnalyticsBatch'],
  ['analytics/council-links.post.ts', 'parsePilotCouncilLinkSync', 'syncPilotCouncilLinks'],
  ['councils/resident-links.post.ts', 'parseResidentCouncilLinkSync', 'syncResidentCouncilLinks'],
  ['councils/demand.post.ts', 'parseCouncilDemandRequest', 'saveCouncilDemandRequest'],
  ['bulky-bookings/start.post.ts', 'parseBulkyBookingStart', 'startBulkyBooking'],
  ['partners/conversion.post.ts', 'parsePartnerConversion', 'savePartnerConversion'],
];

test('public mutation routes separate client validation from dependency failures', async () => {
  for (const [relativePath, parser, operation] of routes) {
    const source = await readFile(
      new URL(`../server/routes/api/${relativePath}`, import.meta.url),
      'utf8',
    );
    const firstCatch = source.indexOf('} catch (error)');
    assert.ok(firstCatch > 0, `${relativePath} has no validation catch`);
    assert.ok(source.indexOf(`${parser}(`) < firstCatch, `${relativePath} does not parse before its first catch`);
    assert.ok(source.indexOf(`${operation}(`) > firstCatch, `${relativePath} performs dependency work inside its validation catch`);
    assert.match(source, /apiUnexpectedErrorResponse\(/, `${relativePath} has no stable logged 5xx boundary`);
  }
});
