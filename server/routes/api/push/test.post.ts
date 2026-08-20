import { defineHandler } from 'nitro';

import { apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, apiUnexpectedErrorResponse, readBoundedJson } from '../../../lib/api-http';
import {
  deliverWebPush,
  parsePushSubscription,
} from '../../../lib/push-reminders';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  let subscription: ReturnType<typeof parsePushSubscription>;
  try {
    const body = await readBoundedJson<{ subscription?: unknown }>(event.req, 8_192);
    subscription = parsePushSubscription(body.subscription);
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error)
      ?? apiError(requestId, 400, 'INVALID_PUSH_SUBSCRIPTION', 'The notification subscription is invalid.');
  }
  try {
    await deliverWebPush(subscription, {
      id: `test-${Date.now()}`,
      title: 'Bin reminders are working',
      body: 'You’ll get a notification the evening before each verified collection.',
      url: '/settings',
      tag: 'bin-reminder-test',
    });
    return apiJson(requestId, { delivered: true });
  } catch (error) {
    return apiUnexpectedErrorResponse(requestId, '/api/push/test', error, 'The test notification could not be sent.', 502);
  }
});
