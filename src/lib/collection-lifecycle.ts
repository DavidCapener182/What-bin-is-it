import type {
  Collection,
  CollectionLifecycleStage,
  CollectionOutcome,
  DisruptionAlert,
} from '@/lib/types';

const collectionStartHour = 7;
const collectionEndHour = 17;

export type CollectionLifecycle = {
  stage: CollectionLifecycleStage;
  title: string;
  detail: string;
  canMarkPutOut: boolean;
  canConfirmCollected: boolean;
  canReportMissed: boolean;
  blockedReason?: string;
};

function localDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function sameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
}

function activeDisruption(alerts: DisruptionAlert[], collection: Collection, now: Date) {
  return alerts.find((alert) => {
    const starts = new Date(alert.startsAt);
    const ends = alert.endsAt ? new Date(alert.endsAt) : undefined;
    return starts <= now && (!ends || ends >= now) && alert.addressId.length > 0
      && (!alert.expectedRecollectionDate || alert.expectedRecollectionDate >= collection.date);
  });
}

export function eligibleAfter(collectionDate: string) {
  const date = localDate(collectionDate);
  date.setHours(collectionEndHour, 0, 0, 0);
  return date;
}

export function deriveCollectionLifecycle(
  collection: Collection,
  outcome: CollectionOutcome | undefined,
  alerts: DisruptionAlert[] = [],
  now = new Date(),
  reporting?: { eligibleAfter: Date; reason: string },
): CollectionLifecycle {
  const dueDate = localDate(collection.date);
  const disruption = activeDisruption(alerts, collection, now);
  const reportingThreshold = reporting?.eligibleAfter ?? eligibleAfter(collection.date);

  if (outcome?.status === 'collected' || outcome?.status === 'brought-in') {
    return {
      stage: 'collected',
      title: outcome.status === 'brought-in' ? 'Bin brought in' : 'Collected',
      detail: outcome.status === 'brought-in'
        ? 'You confirmed the bin is back at the property.'
        : 'You confirmed this collection was completed.',
      canMarkPutOut: false,
      canConfirmCollected: false,
      canReportMissed: false,
    };
  }

  if (outcome?.status === 'missed') {
    return {
      stage: 'missed',
      title: 'Marked as missed',
      detail: 'Check the report status or open the official council service.',
      canMarkPutOut: false,
      canConfirmCollected: true,
      canReportMissed: true,
    };
  }

  const beforeDueDay = now < dueDate && !sameLocalDay(now, dueDate);
  if (beforeDueDay) {
    return {
      stage: 'before',
      title: outcome?.status === 'put-out' ? 'Bins are out' : 'Get ready for collection',
      detail: outcome?.status === 'put-out'
        ? 'We will ask whether they were collected after the collection window.'
        : 'Put the listed bins at the collection point before the council cut-off.',
      canMarkPutOut: outcome?.status !== 'put-out',
      canConfirmCollected: false,
      canReportMissed: false,
    };
  }

  if (sameLocalDay(now, dueDate)) {
    if (now.getHours() < collectionStartHour) {
      return {
        stage: 'morning',
        title: outcome?.status === 'put-out' ? 'Bins are out' : 'Collection is due today',
        detail: outcome?.status === 'put-out'
          ? 'Collection crews may arrive from early morning.'
          : 'Put the bins at the collection point now if the council cut-off has not passed.',
        canMarkPutOut: outcome?.status !== 'put-out',
        canConfirmCollected: true,
        canReportMissed: false,
      };
    }

    if (now < reportingThreshold) {
      return {
        stage: 'in-progress',
        title: 'Collection window in progress',
        detail: disruption?.detail ?? 'Crews may collect at any point during the day.',
        canMarkPutOut: outcome?.status !== 'put-out',
        canConfirmCollected: true,
        canReportMissed: false,
        blockedReason: disruption
          ? 'A verified service alert is active. Wait for the council update before reporting.'
          : reporting?.reason ?? 'Most councils ask residents to wait until the collection window has ended.',
      };
    }

    if (disruption) {
      return {
        stage: 'awaiting-confirmation',
        title: disruption.title,
        detail: disruption.detail,
        canMarkPutOut: false,
        canConfirmCollected: true,
        canReportMissed: false,
        blockedReason: 'Reporting is paused while this verified disruption is active.',
      };
    }

    return {
      stage: 'awaiting-confirmation',
      title: 'Was it collected?',
      detail: 'Confirm the outcome. If it was missed, we will check the reporting route before sending you to the council.',
      canMarkPutOut: false,
      canConfirmCollected: true,
      canReportMissed: true,
    };
  }

  if (now > reportingThreshold) {
    return {
      stage: 'awaiting-confirmation',
      title: 'Confirm the collection outcome',
      detail: disruption?.detail ?? 'Tell us whether the bin was collected or missed.',
      canMarkPutOut: false,
      canConfirmCollected: true,
      canReportMissed: !disruption,
      blockedReason: disruption ? 'A verified disruption is active for this collection.' : undefined,
    };
  }

  return {
    stage: 'complete',
    title: 'Collection complete',
    detail: 'This collection is in your activity history.',
    canMarkPutOut: false,
    canConfirmCollected: false,
    canReportMissed: false,
  };
}
