import { defineHandler } from 'nitro';

import { apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, apiUnexpectedErrorResponse, readBoundedJson } from '../../../../lib/api-http';
import {
  councilBroadcastAuthorised,
  parseCouncilBroadcastRequest,
  processCouncilBroadcast,
} from '../../../../lib/council-alert-push';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  if (!councilBroadcastAuthorised(event.req.headers.get('authorization'))) {
    return apiError(requestId, 401, 'BROADCAST_AUTHENTICATION_FAILED', 'The council broadcast request was not authorised.');
  }
  let jobId: string;
  try {
    ({ jobId } = parseCouncilBroadcastRequest(await readBoundedJson(event.req, 1_024)));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error)
      ?? apiError(requestId, 400, 'INVALID_BROADCAST_REQUEST', 'The council broadcast request is invalid.');
  }
  try {
    return apiJson(requestId, await processCouncilBroadcast(jobId));
  } catch (error) {
    return apiUnexpectedErrorResponse(requestId, '/api/push/broadcasts/process', error, 'The council broadcast could not be processed.');
  }
});
