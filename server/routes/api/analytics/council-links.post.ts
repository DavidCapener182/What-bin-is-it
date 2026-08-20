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
  parsePilotCouncilLinkSync,
  pilotAnalyticsConfigured,
  syncPilotCouncilLinks,
} from '../../../lib/pilot-analytics';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  const cors = pilotAnalyticsCorsHeaders(event.req);
  if (!pilotAnalyticsConfigured()) {
    return apiError(requestId, 503, 'ANALYTICS_UNAVAILABLE', 'Anonymous app evidence is not configured.', cors);
  }
  let input: ReturnType<typeof parsePilotCouncilLinkSync>;
  try {
    input = parsePilotCouncilLinkSync(await readBoundedJson(event.req, 4_096));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error, cors)
      ?? apiError(requestId, 400, 'INVALID_COUNCIL_LINK_UPDATE', 'The council link update is invalid.', cors);
  }
  try {
    const result = await syncPilotCouncilLinks(input);
    return apiJson(requestId, result, { headers: cors });
  } catch (error) {
    return apiUnexpectedErrorResponse(
      requestId,
      '/api/analytics/council-links',
      error,
      'Council link storage is temporarily unavailable.',
      503,
      cors,
    );
  }
});
