import { defineHandler } from 'nitro';
import { getRun, start } from 'workflow/api';

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
  try {
    const body = await event.req.json() as {
      subscription?: unknown;
      reminders?: unknown;
      previous?: unknown;
    };
    const { privateKey } = vapidConfiguration();
    await cancelPreviousRun(body.previous, privateKey);
    const reminders = parsePushReminders(body.reminders);
    if (reminders.length === 0) {
      return Response.json({ scheduledCount: 0 }, {
        headers: { 'cache-control': 'no-store' },
      });
    }
    const subscription = parsePushSubscription(body.subscription);
    const run = await start(pushReminderWorkflow, [subscription, reminders]);
    return Response.json({
      runId: run.runId,
      token: signRunId(run.runId, privateKey),
      scheduledCount: reminders.length,
      nextTriggerAt: reminders[0].triggerAt,
    }, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'The reminder schedule could not be updated.';
    return Response.json({ error: message }, {
      status: 400,
      headers: { 'cache-control': 'no-store' },
    });
  }
});
