import { defineHandler } from 'nitro';

import { type BinAccountUser, requireBinAccount } from '../../../lib/bin-auth';
import { apiAuthenticationErrorResponse, apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, apiUnexpectedErrorResponse, readBoundedJson } from '../../../lib/api-http';
import {
  parseResidentSupportReply,
  replyToResidentSupportThread,
  ResidentSupportOperationError,
} from '../../../lib/resident-support';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  let user: BinAccountUser;
  try {
    user = await requireBinAccount(event.req);
  } catch (error) {
    return apiAuthenticationErrorResponse(requestId, error)
      ?? apiUnexpectedErrorResponse(requestId, '/api/support/reply', error, 'Account verification is unavailable.', 503);
  }
  let input: ReturnType<typeof parseResidentSupportReply>;
  try {
    input = parseResidentSupportReply(await readBoundedJson(event.req, 16_384));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error)
      ?? apiError(requestId, 400, 'INVALID_SUPPORT_REPLY', 'The reply is invalid.');
  }
  try {
    return apiJson(requestId, {
      threads: await replyToResidentSupportThread(user, input),
    });
  } catch (error) {
    if (error instanceof ResidentSupportOperationError) {
      return apiError(requestId, error.status, error.code, error.message);
    }
    return apiUnexpectedErrorResponse(requestId, '/api/support/reply', error, 'Your reply could not be sent. Try again shortly.');
  }
});
