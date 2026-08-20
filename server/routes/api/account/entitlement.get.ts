import { defineHandler } from 'nitro';

import { apiAuthenticationErrorResponse, apiJson, apiRequestId, apiUnexpectedErrorResponse } from '../../../lib/api-http';
import {
  getOrCreateBinEntitlement,
  requireBinAccount,
} from '../../../lib/bin-auth';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  let user;
  try {
    user = await requireBinAccount(event.req);
  } catch (error) {
    return apiAuthenticationErrorResponse(requestId, error)
      ?? apiUnexpectedErrorResponse(requestId, '/api/account/entitlement', error, 'Account verification is unavailable.', 503);
  }
  try {
    const entitlement = await getOrCreateBinEntitlement(user.id);
    return apiJson(requestId, { entitlement });
  } catch (error) {
    return apiUnexpectedErrorResponse(requestId, '/api/account/entitlement', error, 'Your plan could not be checked.');
  }
});
