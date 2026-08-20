import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const notificationRoutes = require('../shared/notification-routes.json');

export const APPROVED_NOTIFICATION_PATHS = Object.freeze([...notificationRoutes]);

export const NOTIFICATION_DEFAULTS = Object.freeze({
  title: 'Bin reminder',
  body: 'Your collection is coming up.',
  tag: 'bin-reminder',
  url: '/schedule',
  actions: [],
});

const approvedNotificationPathSet = new Set(APPROVED_NOTIFICATION_PATHS);
export const APPROVED_NOTIFICATION_ACTIONS = Object.freeze({
  'open-schedule': { title: 'View schedule', url: '/schedule' },
  dismiss: { title: 'Dismiss' },
});

function boundedNotificationText(value, fallback, maximum) {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return text ? text.slice(0, maximum) : fallback;
}

export function approvedNotificationPath(value) {
  return typeof value === 'string' && approvedNotificationPathSet.has(value)
    ? value
    : NOTIFICATION_DEFAULTS.url;
}

export function sanitiseNotificationPayload(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    title: boundedNotificationText(input.title, NOTIFICATION_DEFAULTS.title, 80),
    body: boundedNotificationText(input.body, NOTIFICATION_DEFAULTS.body, 240),
    tag: boundedNotificationText(input.tag, NOTIFICATION_DEFAULTS.tag, 120),
    url: approvedNotificationPath(input.url),
    actions: sanitiseNotificationActions(input.actions),
  };
}

export function sanitiseNotificationActions(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const actions = [];
  for (const candidate of value.slice(0, 8)) {
    if (actions.length >= 2) break;
    const action = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
      ? candidate.action
      : undefined;
    if (typeof action !== 'string' || seen.has(action)) continue;
    const approved = APPROVED_NOTIFICATION_ACTIONS[action];
    if (!approved) continue;
    seen.add(action);
    actions.push({ action, title: approved.title });
  }
  return actions;
}

export function notificationActionTarget(action, fallbackUrl) {
  if (action === 'dismiss') return undefined;
  const approved = typeof action === 'string' ? APPROVED_NOTIFICATION_ACTIONS[action] : undefined;
  return approved?.url ?? approvedNotificationPath(fallbackUrl);
}

export function serviceWorkerNotificationSafetySource() {
  return [
    `const approvedNotificationPathSet = new Set(${JSON.stringify(APPROVED_NOTIFICATION_PATHS)});`,
    `const NOTIFICATION_DEFAULTS = ${JSON.stringify(NOTIFICATION_DEFAULTS)};`,
    `const APPROVED_NOTIFICATION_ACTIONS = ${JSON.stringify(APPROVED_NOTIFICATION_ACTIONS)};`,
    boundedNotificationText.toString(),
    approvedNotificationPath.toString(),
    sanitiseNotificationActions.toString(),
    sanitiseNotificationPayload.toString(),
    notificationActionTarget.toString(),
  ].join('\n\n');
}
