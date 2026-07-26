type ReminderWasteType = 'general' | 'recycling' | 'garden' | 'food' | 'other';

type ReminderCollection = {
  id: string;
  date: string;
  wasteType: ReminderWasteType;
  label?: string;
  placeLabel?: string;
};

type ReminderPreferences = {
  enabled: boolean;
  reminderHour: number;
  reminderDayOffset: 0 | 1;
  wasteTypes: Record<ReminderWasteType, boolean>;
};

export type PlannedReminder = {
  id: string;
  collectionId: string;
  triggerAt: Date;
  title: string;
  body: string;
  url: string;
};

const defaultLabels: Record<ReminderWasteType, string> = {
  general: 'General waste',
  recycling: 'Mixed recycling',
  garden: 'Garden waste',
  food: 'Food waste',
  other: 'Council bin',
};

function collectionDateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function planCollectionReminders(
  collections: ReminderCollection[],
  preferences: ReminderPreferences,
  now = new Date(),
  limit = 48
): PlannedReminder[] {
  if (!preferences.enabled) return [];

  return [...collections]
    .sort((left, right) => left.date.localeCompare(right.date))
    .filter((collection) => preferences.wasteTypes[collection.wasteType])
    .map((collection) => {
      const triggerAt = collectionDateAtNoon(collection.date);
      triggerAt.setDate(triggerAt.getDate() - preferences.reminderDayOffset);
      triggerAt.setHours(preferences.reminderHour, 0, 0, 0);
      const label = collection.label?.trim() || defaultLabels[collection.wasteType];
      const place = collection.placeLabel?.trim();
      return {
        id: `${collection.id}:${triggerAt.toISOString()}`,
        collectionId: collection.id,
        triggerAt,
        title: 'Bin reminder',
        body: `${label} collection${place ? ` for ${place}` : ''} is ${preferences.reminderDayOffset === 0 ? 'today' : 'tomorrow'}. Put it out before 7am.`,
        url: '/calendar',
      };
    })
    .filter((reminder) => reminder.triggerAt > now)
    .slice(0, limit);
}
