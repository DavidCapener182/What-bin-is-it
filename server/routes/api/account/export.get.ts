import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import { binDatabase } from '../../../lib/bin-database';

export default defineHandler(async (event) => {
  try {
    const user = await requireBinAccount(event.req);
    const sql = binDatabase();
    const [entitlements, grants, supporter, nativeEvents] = await Promise.all([
      sql`
        SELECT plan_id, source, status, product_id, current_period_end, created_at, updated_at
        FROM bin_user_entitlements
        WHERE user_id = ${user.id}
      `,
      sql`
        SELECT source, plan_id, status, product_id, current_period_end, provider_event_at, created_at, updated_at
        FROM bin_entitlement_grants
        WHERE user_id = ${user.id}
        ORDER BY provider_event_at DESC
      `,
      sql`
        SELECT plan_id, billing_mode, status, currency, amount_pence, started_at, current_period_end, cancelled_at, updated_at
        FROM bin_supporters
        WHERE user_id = ${user.id}
      `,
      sql`
        SELECT event_type, product_id, store, environment, outcome, occurred_at, received_at
        FROM bin_revenuecat_events
        WHERE user_id = ${user.id}
        ORDER BY occurred_at DESC
        LIMIT 250
      `,
    ]);
    return Response.json({
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      savedAddresses: 'Stored only on the resident device and not included in the account export.',
      entitlements,
      providerGrants: grants,
      webBilling: supporter,
      nativeBillingEvents: nativeEvents,
    }, {
      headers: {
        'cache-control': 'no-store',
        'content-disposition': 'attachment; filename="what-bin-account-export.json"',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Your account export could not be created.',
    }, {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    });
  }
});
