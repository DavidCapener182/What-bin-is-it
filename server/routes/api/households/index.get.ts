import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import { apiAuthenticationErrorResponse, apiJson, apiRequestId, apiUnexpectedErrorResponse } from '../../../lib/api-http';
import { listResidentHouseholds } from '../../../lib/resident-households';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  try {
    const user = await requireBinAccount(event.req);
    return apiJson(requestId, { households: await listResidentHouseholds(user.id) });
  } catch (error) {
    return apiAuthenticationErrorResponse(requestId, error)
      ?? apiUnexpectedErrorResponse(requestId, '/api/households', error, 'Households could not be loaded.');
  }
});
