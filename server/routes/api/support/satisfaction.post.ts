import { defineHandler } from 'nitro';

import { type BinAccountUser, requireBinAccount } from '../../../lib/bin-auth';
import { apiAuthenticationErrorResponse, apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, apiUnexpectedErrorResponse, readBoundedJson } from '../../../lib/api-http';
import {
  parseResidentSupportSatisfaction,
  rateResidentSupportThread,
  ResidentSupportOperationError,
} from '../../../lib/resident-support';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  let user: BinAccountUser;
  try {
    user = await requireBinAccount(event.req);
  } catch (error) {
    return apiAuthenticationErrorResponse(requestId, error)
      ?? apiUnexpectedErrorResponse(requestId, '/api/support/satisfaction', error, 'Account verification is unavailable.', 503);
  }
  let input: ReturnType<typeof parseResidentSupportSatisfaction>;
  try {
    input = parseResidentSupportSatisfaction(await readBoundedJson(event.req, 1_024));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error)
      ?? apiError(requestId, 400, 'INVALID_SUPPORT_RATING', 'The satisfaction response is invalid.');
  }
  try {
    return apiJson(requestId, { threads: await rateResidentSupportThread(user, input) });
  } catch (error) {
    if (error instanceof ResidentSupportOperationError) {
      return apiError(requestId, error.status, error.code, error.message);
    }
    return apiUnexpectedErrorResponse(requestId, '/api/support/satisfaction', error, 'Your response could not be saved.');
  }
});
