import { defineHandler } from 'nitro';

import {
  apiError,
  apiJson,
  apiRequestBodyErrorResponse,
  apiRequestId,
  apiUnexpectedErrorResponse,
  readBoundedJson,
} from '../../../lib/api-http';
import {
  parsePilotAnalyticsBatch,
  PilotAnalyticsRateLimitError,
  pilotAnalyticsConfigured,
  savePilotAnalyticsBatch,
} from '../../../lib/pilot-analytics';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  const cors = pilotAnalyticsCorsHeaders(event.req);
  if (!pilotAnalyticsConfigured()) {
    return apiError(requestId, 503, 'ANALYTICS_UNAVAILABLE', 'Anonymous app evidence is not configured.', cors);
  }
  let batch: ReturnType<typeof parsePilotAnalyticsBatch>;
  try {
    batch = parsePilotAnalyticsBatch(await readBoundedJson(event.req, 32_768));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error, cors)
      ?? apiError(requestId, 400, 'INVALID_ANALYTICS_REQUEST', 'The analytics request is invalid.', cors);
  }
  try {
    const accepted = await savePilotAnalyticsBatch(batch);
    return apiJson(requestId, { accepted }, { headers: cors });
  } catch (error) {
    if (error instanceof PilotAnalyticsRateLimitError) {
      return apiError(requestId, 429, 'ANALYTICS_RATE_LIMITED', 'The analytics event limit has been reached. Try again later.', cors);
    }
    return apiUnexpectedErrorResponse(
      requestId,
      '/api/analytics/events',
      error,
      'Anonymous analytics storage is temporarily unavailable.',
      503,
      cors,
    );
  }
});
