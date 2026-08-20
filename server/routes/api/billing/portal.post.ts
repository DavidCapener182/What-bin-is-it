import { defineHandler } from 'nitro';

import { BinAccountAuthenticationError, requireBinAccount } from '../../../lib/bin-auth';
import {
  apiError,
  apiJson,
  apiRequestBodyErrorResponse,
  apiRequestId,
  logApiFailure,
  readBoundedRequestBytes,
} from '../../../lib/api-http';
import {
  createSupporterPortal,
  requestHasTrustedOrigin,
  safeCheckoutOrigin,
  webBillingConfigured,
} from '../../../lib/web-billing';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  if (!webBillingConfigured()) {
    return apiError(requestId, 503, 'BILLING_UNAVAILABLE', 'Secure web billing is not configured yet.');
  }
  if (!requestHasTrustedOrigin(event.req)) {
    return apiError(requestId, 403, 'ORIGIN_NOT_ALLOWED', 'The billing request origin was not accepted.');
  }
  try {
    await readBoundedRequestBytes(event.req, 1_024);
    const user = await requireBinAccount(event.req);
    const url = await createSupporterPortal(user.id, safeCheckoutOrigin(event.req.url));
    return apiJson(requestId, { url });
  } catch (error) {
    const bodyError = apiRequestBodyErrorResponse(requestId, error);
    if (bodyError) return bodyError;
    if (error instanceof BinAccountAuthenticationError) {
      return apiError(requestId, error.status, error.code, error.message);
    }
    logApiFailure(requestId, '/api/billing/portal', error);
    return apiError(requestId, 502, 'BILLING_PORTAL_UNAVAILABLE', 'The billing portal could not be opened.');
  }
});
