import { defineHandler } from 'nitro';

import {
  apiError,
  apiJson,
  apiRequestBodyErrorResponse,
  apiRequestId,
  apiUnexpectedErrorResponse,
  readBoundedJson,
} from '../../../lib/api-http';
import { parseCouncilDemandRequest, saveCouncilDemandRequest } from '../../../lib/council-demand';
import { binDatabaseConfigured } from '../../../lib/bin-database';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  const headers = pilotAnalyticsCorsHeaders(event.req);
  if (!binDatabaseConfigured()) return apiError(requestId, 503, 'COUNCIL_REQUEST_STORAGE_UNAVAILABLE', 'Council request storage is not configured.', headers);
  let input: ReturnType<typeof parseCouncilDemandRequest>;
  try {
    input = parseCouncilDemandRequest(await readBoundedJson(event.req, 2_048));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error, headers)
      ?? apiError(requestId, 400, 'INVALID_COUNCIL_REQUEST', 'The council request is invalid.', headers);
  }
  try {
    return apiJson(requestId, await saveCouncilDemandRequest(input), { headers });
  } catch (error) {
    return apiUnexpectedErrorResponse(
      requestId,
      '/api/councils/demand',
      error,
      'Council request storage is temporarily unavailable.',
      503,
      headers,
    );
  }
});
