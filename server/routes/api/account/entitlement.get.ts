import { defineHandler } from 'nitro';

import {
  getOrCreateBinEntitlement,
  requireBinAccount,
} from '../../../lib/bin-auth';

export default defineHandler(async (event) => {
  try {
    const user = await requireBinAccount(event.req);
    const entitlement = await getOrCreateBinEntitlement(user.id);
    return new Response(JSON.stringify({ entitlement }), {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Your plan could not be checked.',
    }, {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    });
  }
});
