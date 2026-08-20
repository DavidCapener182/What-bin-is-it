import { defineHandler } from 'nitro';

import { apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, readBoundedJson } from '../../../lib/api-http';
import {
  deleteResidentCouncilInstallation,
  isPilotParticipantId,
  pilotAnalyticsConfigured,
} from '../../../lib/pilot-analytics';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  const headers = pilotAnalyticsCorsHeaders(event.req);
  if (!pilotAnalyticsConfigured()) {
    return apiError(requestId, 503, 'RESIDENT_COUNCIL_STORAGE_UNAVAILABLE', 'Resident council storage is not configured.', headers);
  }
  try {
    const body = await readBoundedJson<{ installationId?: unknown }>(event.req, 1_024);
    if (!isPilotParticipantId(body.installationId)) {
      return apiError(requestId, 400, 'INVALID_INSTALLATION_ID', 'The resident installation ID is invalid.', headers);
    }
    const deleted = await deleteResidentCouncilInstallation(body.installationId);
    return apiJson(requestId, { deleted }, { headers });
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error, headers)
      ?? apiError(requestId, 400, 'INVALID_DELETION_REQUEST', 'The deletion request is invalid.', headers);
  }
});
