import { defineHandler } from 'nitro';

import { apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, apiUnexpectedErrorResponse, readBoundedJson } from '../../../lib/api-http';
import {
  parseCouncilAlertRegistration,
  syncCouncilAlertRegistration,
} from '../../../lib/council-alert-push';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  const headers = pilotAnalyticsCorsHeaders(event.req);
  let registration: ReturnType<typeof parseCouncilAlertRegistration>;
  try {
    registration = parseCouncilAlertRegistration(await readBoundedJson(event.req, 8_192));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error, headers)
      ?? apiError(requestId, 400, 'INVALID_PUSH_REGISTRATION', 'The notification registration is invalid.', headers);
  }
  try {
    const result = await syncCouncilAlertRegistration(registration);
    return apiJson(requestId, result, { headers });
  } catch (error) {
    return apiUnexpectedErrorResponse(requestId, '/api/push/registrations', error, 'The notification registration could not be saved.', 500, headers);
  }
});
