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
  reminderMinute?: number;
  reminderDayOffset: 0 | 1;
  wasteTypes: Record<ReminderWasteType, boolean>;
  morningReminder?: boolean;
  morningHour?: number;
  secondReminder?: boolean;
  secondReminderHour?: number;
  collectionFollowUp?: boolean;
  followUpHour?: number;
  followUpMinute?: number;
  followUpDayOffset?: number;
  presentationTime?: string;
};

export type PlannedReminder = {
  id: string;
  collectionId: string;
  triggerAt: Date;
  title: string;
  body: string;
  url: string;
};

export type PlaceReminderPlan = {
  collections: ReminderCollection[];
  preferences: ReminderPreferences;
  answeredCollectionIds?: ReadonlySet<string>;
  putOutCollectionIds?: ReadonlySet<string>;
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
  limit = 48,
  answeredCollectionIds: ReadonlySet<string> = new Set(),
  putOutCollectionIds: ReadonlySet<string> = new Set(),
): PlannedReminder[] {
  if (!preferences.enabled) return [];

  return [...collections]
    .sort((left, right) => left.date.localeCompare(right.date))
    .filter((collection) => preferences.wasteTypes[collection.wasteType])
    .flatMap((collection) => {
      const label = collection.label?.trim() || defaultLabels[collection.wasteType];
      const place = collection.placeLabel?.trim();
      const placeCopy = place ? ` for ${place}` : '';
      const planned: PlannedReminder[] = [];
      const mainTrigger = collectionDateAtNoon(collection.date);
      mainTrigger.setDate(mainTrigger.getDate() - preferences.reminderDayOffset);
      mainTrigger.setHours(preferences.reminderHour, preferences.reminderMinute ?? 0, 0, 0);
      planned.push({
        id: `${collection.id}:bin-night:${mainTrigger.toISOString()}`,
        collectionId: collection.id,
        triggerAt: mainTrigger,
        title: 'Bin reminder',
        body: `${label} collection${placeCopy} is ${preferences.reminderDayOffset === 0 ? 'today' : 'tomorrow'}. Put it out before ${preferences.presentationTime ?? '7am'}.`,
        url: '/schedule',
      });

      if (preferences.secondReminder && !putOutCollectionIds.has(collection.id)) {
        const secondTrigger = collectionDateAtNoon(collection.date);
        secondTrigger.setDate(secondTrigger.getDate() - 1);
        secondTrigger.setHours(preferences.secondReminderHour ?? 21, 0, 0, 0);
        planned.push({
          id: `${collection.id}:second:${secondTrigger.toISOString()}`,
          collectionId: collection.id,
          triggerAt: secondTrigger,
          title: 'Bin still to put out?',
          body: `${label}${placeCopy} is due tomorrow. Mark it as out when it is ready.`,
          url: '/',
        });
      }

      if (preferences.morningReminder) {
        const morningTrigger = collectionDateAtNoon(collection.date);
        morningTrigger.setHours(preferences.morningHour ?? 7, 0, 0, 0);
        planned.push({
          id: `${collection.id}:morning:${morningTrigger.toISOString()}`,
          collectionId: collection.id,
          triggerAt: morningTrigger,
          title: 'Collection today',
          body: `${label}${placeCopy} is due today. Leave it accessible until the collection is complete.`,
          url: '/',
        });
      }

      if (preferences.collectionFollowUp && !answeredCollectionIds.has(collection.id)) {
        const followUpTrigger = collectionDateAtNoon(collection.date);
        followUpTrigger.setDate(followUpTrigger.getDate() + (preferences.followUpDayOffset ?? 0));
        followUpTrigger.setHours(
          preferences.followUpHour ?? 18,
          preferences.followUpMinute ?? 0,
          0,
          0,
        );
        planned.push({
          id: `${collection.id}:follow-up:${followUpTrigger.toISOString()}`,
          collectionId: collection.id,
          triggerAt: followUpTrigger,
          title: 'Was your bin collected?',
          body: `${label}${placeCopy} was due today. Confirm the result or start a missed collection report.`,
          url: '/',
        });
      }

      return planned;
    })
    .filter((reminder) => reminder.triggerAt > now)
    .slice(0, limit);
}

export function planPlaceCollectionReminders(
  places: PlaceReminderPlan[],
  now = new Date(),
  limit = 48,
) {
  const reminders = places.flatMap((place) => (
    planCollectionReminders(
      place.collections,
      place.preferences,
      now,
      limit,
      place.answeredCollectionIds,
      place.putOutCollectionIds,
    )
  ));
  const unique = new Map(reminders.map((reminder) => [reminder.id, reminder]));
  return [...unique.values()]
    .sort((left, right) => left.triggerAt.getTime() - right.triggerAt.getTime())
    .slice(0, limit);
}
