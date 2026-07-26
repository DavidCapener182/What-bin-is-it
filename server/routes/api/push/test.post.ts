import { defineHandler } from 'nitro';

import {
  deliverWebPush,
  parsePushSubscription,
} from '../../../lib/push-reminders';

export default defineHandler(async (event) => {
  try {
    const body = await event.req.json() as { subscription?: unknown };
    const subscription = parsePushSubscription(body.subscription);
    await deliverWebPush(subscription, {
      id: `test-${Date.now()}`,
      title: 'Bin reminders are working',
      body: 'You’ll get a notification the evening before each verified collection.',
      url: '/settings',
      tag: 'bin-reminder-test',
    });
    return Response.json({ delivered: true }, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'The test notification could not be sent.';
    return Response.json({ error: message }, {
      status: 400,
      headers: { 'cache-control': 'no-store' },
    });
  }
});
