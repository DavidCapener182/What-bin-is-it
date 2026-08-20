import { defineHandler } from 'nitro';

import { apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, readBoundedJson } from '../../../lib/api-http';
import {
  deletePilotParticipant,
  isPilotParticipantId,
  pilotAnalyticsConfigured,
} from '../../../lib/pilot-analytics';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  const responseHeaders = pilotAnalyticsCorsHeaders(event.req);
  if (!pilotAnalyticsConfigured()) {
    return apiError(requestId, 503, 'ANALYTICS_UNAVAILABLE', 'Anonymous app evidence is not configured.', responseHeaders);
  }
  try {
    const body = await readBoundedJson<{ participantId?: unknown }>(event.req, 1_024);
    if (!isPilotParticipantId(body.participantId)) {
      return apiError(requestId, 400, 'INVALID_PARTICIPANT_ID', 'The analytics participant ID is invalid.', responseHeaders);
    }
    const deleted = await deletePilotParticipant(body.participantId);
    return apiJson(requestId, { deleted }, { headers: responseHeaders });
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error, responseHeaders)
      ?? apiError(requestId, 400, 'INVALID_DELETION_REQUEST', 'The deletion request is invalid.', responseHeaders);
  }
});
