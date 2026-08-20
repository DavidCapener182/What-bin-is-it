import { defineHandler } from 'nitro';

import { type BinAccountUser, requireBinAccount } from '../../../lib/bin-auth';
import { apiAuthenticationErrorResponse, apiJson, apiRequestId, apiUnexpectedErrorResponse } from '../../../lib/api-http';
import { listResidentSupportThreads } from '../../../lib/resident-support';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  let user: BinAccountUser;
  try {
    user = await requireBinAccount(event.req);
  } catch (error) {
    return apiAuthenticationErrorResponse(requestId, error)
      ?? apiUnexpectedErrorResponse(requestId, '/api/support/threads', error, 'Account verification is unavailable.', 503);
  }
  try {
    return apiJson(requestId, {
      threads: await listResidentSupportThreads(user.id),
    });
  } catch (error) {
    return apiUnexpectedErrorResponse(requestId, '/api/support/threads', error, 'Your conversations could not be loaded. Try again shortly.');
  }
});
