import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import {
  parseResidentSupportSatisfaction,
  rateResidentSupportThread,
} from '../../../lib/resident-support';

export default defineHandler(async (event) => {
  let user;
  try {
    user = await requireBinAccount(event.req);
  } catch {
    return Response.json({ error: 'Sign in to rate this support conversation.' }, {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    });
  }
  try {
    const input = parseResidentSupportSatisfaction(await event.req.json());
    return Response.json({ threads: await rateResidentSupportThread(user, input) }, {
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Your response could not be saved.',
    }, {
      status: 400,
      headers: { 'cache-control': 'no-store' },
    });
  }
});
