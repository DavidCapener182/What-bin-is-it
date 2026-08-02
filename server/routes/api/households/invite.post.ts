import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import { createResidentHouseholdInvite, parseHouseholdInvite } from '../../../lib/resident-households';

export default defineHandler(async (event) => {
  try {
    const user = await requireBinAccount(event.req);
    const input = parseHouseholdInvite(await event.req.json());
    return Response.json({ invite: await createResidentHouseholdInvite(user, input.householdId) }, {
      status: 201,
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The invite could not be created.';
    return Response.json({ error: message }, { status: /sign in/i.test(message) ? 401 : 400, headers: { 'cache-control': 'no-store' } });
  }
});
