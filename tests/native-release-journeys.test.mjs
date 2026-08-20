import assert from 'node:assert/strict';
import test from 'node:test';

import { validateNativeJourneys } from '../scripts/validate-native-journeys.mjs';

test('native proof journeys and EAS workflow are deterministic and fail closed', async () => {
  const result = await validateNativeJourneys();
  assert.deepEqual(result.flowFiles, [
    'android/07-offline-cold-start.yaml',
    'android/08-predictive-back.yaml',
    'common/01-onboarding-manual-postcode.yaml',
    'common/02-primary-tabs-and-back.yaml',
    'common/03-push-deep-link-and-magic-return.yaml',
    'common/04-notification-permission-and-reminders.yaml',
    'common/05-widget-and-purchase-gates.yaml',
    'common/06-bulky-checkout-return.yaml',
    'ios/09-live-activity-boundary.yaml',
  ]);
  assert.deepEqual(result.coverageTags, [
    'onboarding',
    'manual-postcode',
    'navigation',
    'push-deep-link',
    'magic-link-return',
    'notification-permission',
    'reminder-scheduling',
    'widget-refresh',
    'purchase-gate',
    'restore-gate',
    'bulky-checkout-return',
    'offline-cold-start',
    'predictive-back',
    'live-activity',
  ]);
});
