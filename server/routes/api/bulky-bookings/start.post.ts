import { defineHandler } from 'nitro';

import { binDatabaseConfigured } from '../../../lib/bin-database';
import { parseBulkyBookingStart, startBulkyBooking } from '../../../lib/bulky-bookings';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const headers = {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...pilotAnalyticsCorsHeaders(event.req),
  };
  if (!binDatabaseConfigured()) return new Response(JSON.stringify({ error: 'Bulky booking tracking is not configured.' }), { status: 503, headers });
  const contentLength = Number(event.req.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 2_048) return new Response(JSON.stringify({ error: 'The booking request is too large.' }), { status: 413, headers });
  try {
    return new Response(JSON.stringify(await startBulkyBooking(parseBulkyBookingStart(await event.req.json()), event.req.url)), { status: 201, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'The booking could not be started.' }), { status: 400, headers });
  }
});
