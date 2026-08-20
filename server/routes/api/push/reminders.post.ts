import { defineHandler } from 'nitro';
import { getRun, start } from 'workflow/api';

import { apiError, apiJson, apiRequestBodyErrorResponse, apiRequestId, apiUnexpectedErrorResponse, readBoundedJson } from '../../../lib/api-http';
import {
  parsePushReminders,
  parsePushSubscription,
  signRunId,
  vapidConfiguration,
  verifyRunToken,
} from '../../../lib/push-reminders';
import { pushReminderWorkflow } from '../../../workflows/push-reminder';

type PreviousRun = { runId?: unknown; token?: unknown };

async function cancelPreviousRun(value: unknown, privateKey: string) {
  if (!value || typeof value !== 'object') return;
  const previous = value as PreviousRun;
  if (
    typeof previous.runId !== 'string'
    || typeof previous.token !== 'string'
    || !verifyRunToken(previous.runId, previous.token, privateKey)
  ) {
    throw new Error('The previous reminder schedule could not be verified.');
  }
  try {
    await getRun(previous.runId).cancel();
  } catch {
    // A completed or already-cancelled run needs no further action.
  }
}

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  let body: {
    subscription?: unknown;
    reminders?: unknown;
    previous?: unknown;
  };
  let privateKey: string;
  let reminders: ReturnType<typeof parsePushReminders>;
  let subscription: ReturnType<typeof parsePushSubscription> | undefined;
  try {
    body = await readBoundedJson(event.req, 64 * 1_024);
    ({ privateKey } = vapidConfiguration());
    reminders = parsePushReminders(body.reminders);
    if (reminders.length > 0) subscription = parsePushSubscription(body.subscription);
  } catch (error) {
    const bodyError = apiRequestBodyErrorResponse(requestId, error);
    if (bodyError) return bodyError;
    if (error instanceof Error && error.message === 'Web push is not configured for this deployment.') {
      return apiError(requestId, 503, 'PUSH_UNAVAILABLE', 'Web push is not configured for this deployment.');
    }
    return apiError(requestId, 400, 'INVALID_REMINDER_SCHEDULE', 'The reminder schedule is invalid.');
  }
  try {
    await cancelPreviousRun(body.previous, privateKey);
    if (reminders.length === 0) {
      return apiJson(requestId, { scheduledCount: 0 });
    }
    const run = await start(pushReminderWorkflow, [subscription!, reminders]);
    return apiJson(requestId, {
      runId: run.runId,
      token: signRunId(run.runId, privateKey),
      scheduledCount: reminders.length,
      nextTriggerAt: reminders[0].triggerAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'The previous reminder schedule could not be verified.') {
      return apiError(requestId, 400, 'INVALID_PREVIOUS_REMINDER', 'The previous reminder schedule could not be verified.');
    }
    return apiUnexpectedErrorResponse(requestId, '/api/push/reminders', error, 'The reminder schedule could not be updated.');
  }
});
