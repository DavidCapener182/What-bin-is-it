import { defineHandler } from 'nitro';

import { type BinAccountUser, requireBinAccount } from '../../../lib/bin-auth';
import { apiAuthenticationErrorResponse, apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, apiUnexpectedErrorResponse, readBoundedJson } from '../../../lib/api-http';
import { parseHouseholdAction, recordResidentHouseholdAction, ResidentHouseholdOperationError } from '../../../lib/resident-households';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  let user: BinAccountUser;
  try {
    user = await requireBinAccount(event.req);
  } catch (error) {
    return apiAuthenticationErrorResponse(requestId, error)
      ?? apiUnexpectedErrorResponse(requestId, '/api/households/action', error, 'Account verification is unavailable.', 503);
  }
  let input: ReturnType<typeof parseHouseholdAction>;
  try {
    input = parseHouseholdAction(await readBoundedJson(event.req, 2_048));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error)
      ?? apiError(requestId, 400, 'INVALID_HOUSEHOLD_ACTION', 'The household action is invalid.');
  }
  try {
    return apiJson(requestId, { households: await recordResidentHouseholdAction(user, input) });
  } catch (error) {
    if (error instanceof ResidentHouseholdOperationError) {
      return apiError(requestId, error.status, error.code, error.message);
    }
    return apiUnexpectedErrorResponse(requestId, '/api/households/action', error, 'The household action could not be saved.');
  }
});
