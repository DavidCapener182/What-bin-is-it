import { defineHandler } from 'nitro';

import {
  apiError,
  apiJson,
  apiRequestBodyErrorResponse,
  apiRequestId,
  logApiFailure,
  readBoundedJson,
} from '../../../lib/api-http';
import {
  processRevenueCatWebhook,
  revenueCatWebhookConfigured,
  verifyRevenueCatWebhook,
} from '../../../lib/native-entitlements';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  if (!revenueCatWebhookConfigured()) {
    return apiError(requestId, 503, 'NATIVE_BILLING_UNAVAILABLE', 'Native billing webhooks are not configured.');
  }
  try {
    verifyRevenueCatWebhook(event.req);
  } catch {
    return apiError(requestId, 401, 'WEBHOOK_AUTHENTICATION_FAILED', 'The native billing webhook was not authenticated.');
  }
  let payload: unknown;
  try {
    payload = await readBoundedJson(event.req, 128 * 1_024);
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error)
      ?? apiError(requestId, 400, 'INVALID_WEBHOOK', 'The native billing webhook payload was invalid.');
  }
  try {
    const processed = await processRevenueCatWebhook(payload);
    return apiJson(requestId, { received: true, processed });
  } catch (error) {
    logApiFailure(requestId, '/api/billing/revenuecat-webhook', error);
    return apiError(requestId, 500, 'WEBHOOK_PROCESSING_FAILED', 'The native billing webhook could not be processed.');
  }
});
