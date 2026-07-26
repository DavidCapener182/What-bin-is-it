import { sleep } from 'workflow';

import {
  BrowserPushSubscription,
  PushReminderPayload,
  deliverWebPush,
} from '../lib/push-reminders';

async function sendReminder(
  subscription: BrowserPushSubscription,
  reminder: PushReminderPayload
) {
  'use step';
  await deliverWebPush(subscription, reminder);
}

export async function pushReminderWorkflow(
  subscription: BrowserPushSubscription,
  reminders: PushReminderPayload[]
) {
  'use workflow';
  for (const reminder of reminders) {
    await sleep(new Date(reminder.triggerAt));
    await sendReminder(subscription, reminder);
  }
  return { delivered: reminders.length };
}
