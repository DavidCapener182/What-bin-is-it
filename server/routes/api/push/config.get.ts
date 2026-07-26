import { defineHandler } from 'nitro';

import { vapidConfiguration } from '../../../lib/push-reminders';

export default defineHandler(() => {
  try {
    const { publicKey } = vapidConfiguration();
    return Response.json({ enabled: true, publicKey }, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return Response.json({
      enabled: false,
      error: 'Web push is not configured for this deployment.',
    }, {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    });
  }
});
