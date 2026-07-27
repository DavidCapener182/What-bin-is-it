import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import {
  createWebCheckout,
  isWebSupporterPlanId,
  requestHasTrustedOrigin,
  safeCheckoutOrigin,
  webBillingConfigured,
} from '../../../lib/web-billing';

export default defineHandler(async (event) => {
  if (!webBillingConfigured()) {
    return Response.json({ error: 'Secure web checkout is not configured yet.' }, { status: 503 });
  }
  if (!requestHasTrustedOrigin(event.req)) {
    return Response.json({ error: 'The checkout request origin was not accepted.' }, { status: 403 });
  }
  try {
    const user = await requireBinAccount(event.req);
    const body = await event.req.json() as { planId?: unknown };
    if (!isWebSupporterPlanId(body.planId)) {
      return Response.json({ error: 'Choose a valid web supporter plan.' }, { status: 400 });
    }
    const url = await createWebCheckout(body.planId, safeCheckoutOrigin(event.req.url), user);
    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Secure checkout could not be opened.',
    }, { status: error instanceof Error && error.message.includes('Sign in') ? 401 : 400 });
  }
});
