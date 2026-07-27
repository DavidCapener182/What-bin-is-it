import { defineHandler } from 'nitro';

import {
  processRevenueCatWebhook,
  revenueCatWebhookConfigured,
  verifyRevenueCatWebhook,
} from '../../../lib/native-entitlements';

export default defineHandler(async (event) => {
  if (!revenueCatWebhookConfigured()) {
    return Response.json({ error: 'Native billing webhooks are not configured.' }, { status: 503 });
  }
  try {
    verifyRevenueCatWebhook(event.req);
    const payload = await event.req.json();
    const processed = await processRevenueCatWebhook(payload);
    return Response.json({ received: true, processed });
  } catch {
    return Response.json({ error: 'The native billing webhook was not accepted.' }, { status: 400 });
  }
});
