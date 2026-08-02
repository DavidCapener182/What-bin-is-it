import { defineHandler } from 'nitro';

import { binDatabaseConfigured } from '../../../lib/bin-database';
import { bulkyBookingStatus, parseBulkyBookingStatus } from '../../../lib/bulky-bookings';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const headers = {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...pilotAnalyticsCorsHeaders(event.req),
  };
  if (!binDatabaseConfigured()) return new Response(JSON.stringify({ error: 'Bulky booking tracking is not configured.' }), { status: 503, headers });
  try {
    const input = parseBulkyBookingStatus(new URL(event.req.url));
    return new Response(JSON.stringify({ booking: await bulkyBookingStatus(input.reference, input.installationId) }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'The booking could not be checked.' }), { status: 400, headers });
  }
});
