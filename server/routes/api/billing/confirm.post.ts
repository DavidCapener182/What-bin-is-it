import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import {
  confirmWebCheckout,
  requestHasTrustedOrigin,
  webBillingConfigured,
} from '../../../lib/web-billing';

export default defineHandler(async (event) => {
  if (!webBillingConfigured()) {
    return Response.json({ error: 'Secure web checkout is not configured yet.' }, { status: 503 });
  }
  if (!requestHasTrustedOrigin(event.req)) {
    return Response.json({ error: 'The checkout confirmation origin was not accepted.' }, { status: 403 });
  }
  try {
    const user = await requireBinAccount(event.req);
    const body = await event.req.json() as { sessionId?: unknown };
    if (typeof body.sessionId !== 'string') {
      return Response.json({ error: 'The checkout session is missing.' }, { status: 400 });
    }
    await confirmWebCheckout(body.sessionId, user.id);
    return new Response(JSON.stringify({ active: true }), {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'The supporter payment could not be confirmed.',
    }, { status: error instanceof Error && error.message.includes('Sign in') ? 401 : 400 });
  }
});
