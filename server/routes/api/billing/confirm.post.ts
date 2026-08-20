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
  confirmWebCheckout,
  requestHasTrustedOrigin,
  webBillingConfigured,
} from '../../../lib/web-billing';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  if (!webBillingConfigured()) {
    return apiError(requestId, 503, 'BILLING_UNAVAILABLE', 'Secure web checkout is not configured yet.');
  }
  if (!requestHasTrustedOrigin(event.req)) {
    return apiError(requestId, 403, 'ORIGIN_NOT_ALLOWED', 'The checkout confirmation origin was not accepted.');
  }
  try {
    const user = await requireBinAccount(event.req);
    const body = await readBoundedJson<{ sessionId?: unknown }>(event.req, 1_024);
    if (typeof body.sessionId !== 'string') {
      return apiError(requestId, 400, 'CHECKOUT_SESSION_REQUIRED', 'The checkout session is missing.');
    }
    await confirmWebCheckout(body.sessionId, user.id);
    return apiJson(requestId, { active: true });
  } catch (error) {
    const bodyError = apiRequestBodyErrorResponse(requestId, error);
    if (bodyError) return bodyError;
    if (error instanceof BinAccountAuthenticationError) {
      return apiError(requestId, error.status, error.code, error.message);
    }
    logApiFailure(requestId, '/api/billing/confirm', error);
    return apiError(
      requestId,
      409,
      'CHECKOUT_NOT_ACTIVE',
      'The verified payment is not active for this account yet.',
    );
  }
});
