import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import { binDatabase } from '../../../lib/bin-database';

export default defineHandler(async (event) => {
  try {
    const user = await requireBinAccount(event.req);
    if (event.req.headers.get('x-bin-confirm-delete') !== 'remove-what-bin-account') {
      return Response.json({ error: 'Account removal was not confirmed.' }, { status: 400 });
    }
    const sql = binDatabase();
    await sql.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
      await transaction`
        UPDATE bin_supporters
        SET user_id = null, updated_at = now()
        WHERE user_id = ${user.id}
      `;
      await transaction`
        DELETE FROM bin_revenuecat_events
        WHERE user_id = ${user.id}
      `;
      await transaction`
        DELETE FROM bin_entitlement_grants
        WHERE user_id = ${user.id}
      `;
      await transaction`
        DELETE FROM bin_user_entitlements
        WHERE user_id = ${user.id}
      `;
    });
    return Response.json({
      removed: true,
      retained:
        'Payment providers may retain transaction records required for billing, fraud prevention and legal obligations.',
    }, {
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Your What Bin account data could not be removed.',
    }, {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    });
  }
});
