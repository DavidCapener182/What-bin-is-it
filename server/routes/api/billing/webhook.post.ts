import { defineHandler } from 'nitro';

import {
  constructStripeEvent,
  processStripeEvent,
  webBillingConfigured,
} from '../../../lib/web-billing';

export default defineHandler(async (event) => {
  if (!webBillingConfigured()) {
    return Response.json({ error: 'Stripe webhooks are not configured.' }, { status: 503 });
  }
  try {
    const body = await event.req.text();
    const stripeEvent = constructStripeEvent(
      body,
      event.req.headers.get('stripe-signature'),
    );
    const processed = await processStripeEvent(stripeEvent);
    return Response.json({ received: true, processed });
  } catch {
    return Response.json({ error: 'The Stripe webhook signature or payload was invalid.' }, { status: 400 });
  }
});
