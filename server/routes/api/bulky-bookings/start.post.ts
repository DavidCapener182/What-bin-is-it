import { defineHandler } from 'nitro';

import {
  apiError,
  apiJson,
  apiRequestBodyErrorResponse,
  apiRequestId,
  apiUnexpectedErrorResponse,
  readBoundedJson,
} from '../../../lib/api-http';
import { binDatabaseConfigured } from '../../../lib/bin-database';
import {
  BulkyBookingRateLimitError,
  parseBulkyBookingStart,
  startBulkyBooking,
} from '../../../lib/bulky-bookings';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  const headers = pilotAnalyticsCorsHeaders(event.req);
  if (!binDatabaseConfigured()) return apiError(requestId, 503, 'BULKY_BOOKING_UNAVAILABLE', 'Bulky booking tracking is not configured.', headers);
  let input: ReturnType<typeof parseBulkyBookingStart>;
  try {
    input = parseBulkyBookingStart(await readBoundedJson(event.req, 2_048));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error, headers)
      ?? apiError(requestId, 400, 'INVALID_BULKY_BOOKING', 'The booking request is invalid.', headers);
  }
  try {
    return apiJson(
      requestId,
      await startBulkyBooking(input, event.req.url),
      { status: 201, headers },
    );
  } catch (error) {
    if (error instanceof BulkyBookingRateLimitError) {
      const limitedHeaders = new Headers(headers);
      limitedHeaders.set('retry-after', String(error.retryAfterSeconds));
      return apiError(requestId, 429, 'BULKY_BOOKING_RATE_LIMITED', 'Too many booking attempts. Try again later.', limitedHeaders);
    }
    return apiUnexpectedErrorResponse(
      requestId,
      '/api/bulky-bookings/start',
      error,
      'The booking service is temporarily unavailable.',
      503,
      headers,
    );
  }
});
