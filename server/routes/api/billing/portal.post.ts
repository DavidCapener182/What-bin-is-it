import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import {
  createSupporterPortal,
  requestHasTrustedOrigin,
  safeCheckoutOrigin,
  webBillingConfigured,
} from '../../../lib/web-billing';

export default defineHandler(async (event) => {
  if (!webBillingConfigured()) {
    return Response.json({ error: 'Secure web billing is not configured yet.' }, { status: 503 });
  }
  if (!requestHasTrustedOrigin(event.req)) {
    return Response.json({ error: 'The billing request origin was not accepted.' }, { status: 403 });
  }
  try {
    const user = await requireBinAccount(event.req);
    const url = await createSupporterPortal(user.id, safeCheckoutOrigin(event.req.url));
    return Response.json({ url });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'The billing portal could not be opened.',
    }, { status: error instanceof Error && error.message.includes('Sign in') ? 401 : 400 });
  }
});
