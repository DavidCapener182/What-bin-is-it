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
  parseResidentCouncilLinkSync,
  pilotAnalyticsConfigured,
  syncResidentCouncilLinks,
} from '../../../lib/pilot-analytics';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  const headers = pilotAnalyticsCorsHeaders(event.req);
  if (!pilotAnalyticsConfigured()) {
    return apiError(requestId, 503, 'RESIDENT_COUNCIL_STORAGE_UNAVAILABLE', 'Resident council storage is not configured.', headers);
  }
  let input: ReturnType<typeof parseResidentCouncilLinkSync>;
  try {
    input = parseResidentCouncilLinkSync(await readBoundedJson(event.req, 4_096));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error, headers)
      ?? apiError(requestId, 400, 'INVALID_RESIDENT_COUNCIL_UPDATE', 'The resident council update is invalid.', headers);
  }
  try {
    const result = await syncResidentCouncilLinks(input);
    return apiJson(requestId, result, { headers });
  } catch (error) {
    return apiUnexpectedErrorResponse(
      requestId,
      '/api/councils/resident-links',
      error,
      'Resident council storage is temporarily unavailable.',
      503,
      headers,
    );
  }
});
