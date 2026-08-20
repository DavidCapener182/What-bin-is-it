import Constants from 'expo-constants';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function contentUpdatedLabel() {
  const configured = Constants.expoConfig?.extra?.contentUpdatedAt;
  if (typeof configured !== 'string' || !isoDatePattern.test(configured)) {
    return `App version ${Constants.expoConfig?.version ?? 'unknown'}`;
  }
  const date = new Date(`${configured}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) {
    return `App version ${Constants.expoConfig?.version ?? 'unknown'}`;
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}
