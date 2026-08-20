import { defineHandler } from 'nitro';

import { apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, readBoundedJson } from '../../../lib/api-http';
import {
  ensurePilotCouncilWorkspaces,
  parsePilotCouncilWorkspaceSync,
  pilotAnalyticsConfigured,
} from '../../../lib/pilot-analytics';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  const headers = pilotAnalyticsCorsHeaders(event.req);
  if (!pilotAnalyticsConfigured()) {
    return apiError(requestId, 503, 'COUNCIL_WORKSPACE_STORAGE_UNAVAILABLE', 'Council portal storage is not configured.', headers);
  }
  try {
    const result = await ensurePilotCouncilWorkspaces(
      parsePilotCouncilWorkspaceSync(await readBoundedJson(event.req, 4_096)).councilIds,
    );
    return apiJson(requestId, result, { headers });
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error, headers)
      ?? apiError(requestId, 400, 'INVALID_COUNCIL_WORKSPACE_UPDATE', 'The council workspace update is invalid.', headers);
  }
});
