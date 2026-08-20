import { defineHandler } from 'nitro';

import { BinAccountAuthenticationError, requireBinAccount } from '../../../lib/bin-auth';
import {
  apiError,
  apiJson,
  apiRequestBodyErrorResponse,
  apiRequestId,
  logApiFailure,
  readBoundedJson,
} from '../../../lib/api-http';
import {
  createWebCheckout,
  isWebSupporterPlanId,
  requestHasTrustedOrigin,
  safeCheckoutOrigin,
  webBillingConfigured,
} from '../../../lib/web-billing';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  if (!webBillingConfigured()) {
    return apiError(requestId, 503, 'BILLING_UNAVAILABLE', 'Secure web checkout is not configured yet.');
  }
  if (!requestHasTrustedOrigin(event.req)) {
    return apiError(requestId, 403, 'ORIGIN_NOT_ALLOWED', 'The checkout request origin was not accepted.');
  }
  try {
    const user = await requireBinAccount(event.req);
    const body = await readBoundedJson<{ planId?: unknown }>(event.req, 2_048);
    if (!isWebSupporterPlanId(body.planId)) {
      return apiError(requestId, 400, 'INVALID_PLAN', 'Choose a valid web supporter plan.');
    }
    const url = await createWebCheckout(body.planId, safeCheckoutOrigin(event.req.url), user);
    return apiJson(requestId, { url });
  } catch (error) {
    const bodyError = apiRequestBodyErrorResponse(requestId, error);
    if (bodyError) return bodyError;
    if (error instanceof BinAccountAuthenticationError) {
      return apiError(requestId, error.status, error.code, error.message);
    }
    logApiFailure(requestId, '/api/billing/checkout', error);
    return apiError(requestId, 502, 'CHECKOUT_UNAVAILABLE', 'Secure checkout could not be opened.');
  }
});
