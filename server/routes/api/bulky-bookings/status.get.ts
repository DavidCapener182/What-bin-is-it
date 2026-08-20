import { defineHandler } from 'nitro';

import { apiError, apiJson, apiRequestId } from '../../../lib/api-http';
import { binDatabaseConfigured } from '../../../lib/bin-database';
import { bulkyBookingStatus, parseBulkyBookingStatus } from '../../../lib/bulky-bookings';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  const headers = pilotAnalyticsCorsHeaders(event.req);
  if (!binDatabaseConfigured()) return apiError(requestId, 503, 'BULKY_BOOKING_UNAVAILABLE', 'Bulky booking tracking is not configured.', headers);
  try {
    const input = parseBulkyBookingStatus(new URL(event.req.url));
    return apiJson(requestId, { booking: await bulkyBookingStatus(input.reference, input.installationId) }, { headers });
  } catch {
    return apiError(requestId, 400, 'INVALID_BULKY_BOOKING_STATUS', 'The booking could not be checked.', headers);
  }
});
