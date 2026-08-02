import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import { listResidentHouseholds } from '../../../lib/resident-households';

export default defineHandler(async (event) => {
  try {
    const user = await requireBinAccount(event.req);
    return Response.json({ households: await listResidentHouseholds(user.id) }, {
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Households could not be loaded.' }, {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    });
  }
});
