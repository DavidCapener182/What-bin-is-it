import { defineHandler } from 'nitro';

import { type BinAccountUser, requireBinAccount } from '../../../lib/bin-auth';
import { apiAuthenticationErrorResponse, apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, apiUnexpectedErrorResponse, readBoundedJson } from '../../../lib/api-http';
import { createResidentHousehold, parseCreateHousehold } from '../../../lib/resident-households';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  let user: BinAccountUser;
  try {
    user = await requireBinAccount(event.req);
  } catch (error) {
    return apiAuthenticationErrorResponse(requestId, error)
      ?? apiUnexpectedErrorResponse(requestId, '/api/households', error, 'Account verification is unavailable.', 503);
  }
  let input: ReturnType<typeof parseCreateHousehold>;
  try {
    input = parseCreateHousehold(await readBoundedJson(event.req, 2_048));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error)
      ?? apiError(requestId, 400, 'INVALID_HOUSEHOLD', 'The household request is invalid.');
  }
  try {
    return apiJson(requestId, { households: await createResidentHousehold(user, input) }, { status: 201 });
  } catch (error) {
    return apiUnexpectedErrorResponse(requestId, '/api/households', error, 'The household could not be created.');
  }
});
