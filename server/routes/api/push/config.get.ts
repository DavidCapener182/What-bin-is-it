import { defineHandler } from 'nitro';

import { apiError, apiJson, apiRequestId } from '../../../lib/api-http';
import { vapidConfiguration } from '../../../lib/push-reminders';

export default defineHandler((event) => {
  const requestId = apiRequestId(event.req);
  try {
    const { publicKey } = vapidConfiguration();
    return apiJson(requestId, { enabled: true, publicKey });
  } catch {
    return apiError(requestId, 503, 'PUSH_UNAVAILABLE', 'Web push is not configured for this deployment.');
  }
});
