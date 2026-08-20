import { defineHandler } from 'nitro';

import {
  apiError,
  apiJson,
  apiRequestBodyErrorResponse,
  apiRequestId,
  logApiFailure,
  readBoundedText,
} from '../../../lib/api-http';
import {
  constructStripeEvent,
  processStripeEvent,
  webBillingConfigured,
} from '../../../lib/web-billing';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  if (!webBillingConfigured()) {
    return apiError(requestId, 503, 'BILLING_UNAVAILABLE', 'Stripe webhooks are not configured.');
  }
  let stripeEvent: ReturnType<typeof constructStripeEvent>;
  try {
    const body = await readBoundedText(event.req, 256 * 1_024);
    stripeEvent = constructStripeEvent(
      body,
      event.req.headers.get('stripe-signature'),
    );
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error)
      ?? apiError(requestId, 400, 'INVALID_WEBHOOK_SIGNATURE', 'The Stripe webhook signature or payload was invalid.');
  }
  try {
    const processed = await processStripeEvent(stripeEvent);
    return apiJson(requestId, { received: true, processed });
  } catch (error) {
    logApiFailure(requestId, '/api/billing/webhook', error);
    return apiError(requestId, 500, 'WEBHOOK_PROCESSING_FAILED', 'The Stripe webhook could not be processed.');
  }
});
