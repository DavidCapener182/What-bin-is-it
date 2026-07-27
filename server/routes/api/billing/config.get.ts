import { defineHandler } from 'nitro';

import {
  webBillingConfigured,
  webBillingLive,
  webSupporterPlans,
} from '../../../lib/web-billing';

export default defineHandler(() => new Response(JSON.stringify({
  configured: webBillingConfigured(),
  live: webBillingLive(),
  currency: 'GBP',
  plans: Object.values(webSupporterPlans).map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    amountPence: plan.amountPence,
    cadence: plan.cadence,
  })),
}), {
  status: 200,
  headers: {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  },
}));
