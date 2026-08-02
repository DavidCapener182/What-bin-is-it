import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import { joinResidentHousehold, parseJoinHousehold } from '../../../lib/resident-households';

export default defineHandler(async (event) => {
  try {
    const user = await requireBinAccount(event.req);
    const input = parseJoinHousehold(await event.req.json());
    return Response.json({ households: await joinResidentHousehold(user, input) }, {
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The household could not be joined.';
    return Response.json({ error: message }, { status: /sign in/i.test(message) ? 401 : 400, headers: { 'cache-control': 'no-store' } });
  }
});
