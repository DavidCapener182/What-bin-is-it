import { defineHandler } from 'nitro';

import { type BinAccountUser, requireBinAccount } from '../../../lib/bin-auth';
import { apiAuthenticationErrorResponse, apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, apiUnexpectedErrorResponse, readBoundedJson } from '../../../lib/api-http';
import {
  createResidentSupportThread,
  parseNewResidentSupportThread,
} from '../../../lib/resident-support';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  let user: BinAccountUser;
  try {
    user = await requireBinAccount(event.req);
  } catch (error) {
    return apiAuthenticationErrorResponse(requestId, error)
      ?? apiUnexpectedErrorResponse(requestId, '/api/support/threads', error, 'Account verification is unavailable.', 503);
  }
  let input: ReturnType<typeof parseNewResidentSupportThread>;
  try {
    input = parseNewResidentSupportThread(await readBoundedJson(event.req, 16_384));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error)
      ?? apiError(requestId, 400, 'INVALID_SUPPORT_MESSAGE', 'The support message is invalid.');
  }
  try {
    return apiJson(requestId, {
      threads: await createResidentSupportThread(user, input),
    }, { status: 201 });
  } catch (error) {
    return apiUnexpectedErrorResponse(requestId, '/api/support/threads', error, 'Your support message could not be sent. Try again shortly.');
  }
});
