import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import { listResidentSupportThreads } from '../../../lib/resident-support';

export default defineHandler(async (event) => {
  let user;
  try {
    user = await requireBinAccount(event.req);
  } catch {
    return Response.json({
      error: 'Sign in to view your support conversations.',
    }, {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    });
  }
  try {
    return Response.json({
      threads: await listResidentSupportThreads(user.id),
    }, {
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return Response.json({
      error: 'Your conversations could not be loaded. Try again shortly.',
    }, {
      status: 500,
      headers: { 'cache-control': 'no-store' },
    });
  }
});
