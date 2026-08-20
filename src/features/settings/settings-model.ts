export type SettingsCategory = 'all' | 'places' | 'account' | 'appearance' | 'activity' | 'notifications' | 'privacy' | 'help' | 'about';

export const settingsCategories: { id: SettingsCategory; label: string; terms: string }[] = [
  { id: 'all', label: 'All', terms: 'all settings' },
  { id: 'places', label: 'Places', terms: 'addresses reminders postcode bins' },
  { id: 'account', label: 'Account', terms: 'account plan plus household sign in' },
  { id: 'appearance', label: 'Appearance', terms: 'appearance light dark theme' },
  { id: 'activity', label: 'Activity', terms: 'reports history missed collection' },
  { id: 'notifications', label: 'Notifications', terms: 'notifications lock screen widget offline pwa alerts' },
  { id: 'privacy', label: 'Data', terms: 'privacy data council sources analytics clear refresh' },
  { id: 'help', label: 'Help', terms: 'help support feedback problem suggest partnerships' },
  { id: 'about', label: 'About', terms: 'about privacy terms sources status version' },
];
