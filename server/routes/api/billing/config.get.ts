import { defineHandler } from 'nitro';

import { apiJson, apiRequestId } from '../../../lib/api-http';
import {
  webBillingConfigured,
  webBillingLive,
  webSupporterPlans,
} from '../../../lib/web-billing';

export default defineHandler((event) => {
  const requestId = apiRequestId(event.req);
  return apiJson(requestId, {
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
  });
});
