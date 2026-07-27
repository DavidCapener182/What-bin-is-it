export type WasteType = 'general' | 'recycling' | 'garden' | 'food' | 'other';

export type Collection = {
  id: string;
  date: string;
  wasteType: WasteType;
  source: 'council';
  label?: string;
  colour?: string;
  placeLabel?: string;
};

export type SavedAddress = {
  id: string;
  label: string;
  line1: string;
  postcode: string;
  councilName: string;
  providerId: string;
  councilAddressId?: string;
  isPrimary: boolean;
  latitude?: number;
  longitude?: number;
};

export type CouncilAddressOption = {
  id: string;
  line1: string;
  postcode: string;
};

export type CouncilService = {
  id: string;
  name: string;
  type: 'recycling-centre' | 'recycling-point' | 'reuse' | 'collection';
  address?: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  source: 'council' | 'openstreetmap';
  website?: string;
  materials?: string[];
  openingHours?: string;
  isOpenNow?: boolean;
  operator?: string;
  councilOperated?: boolean;
  wheelchairAccessible?: boolean;
};

export type NotificationPreferences = {
  enabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  reminderDayOffset: 0 | 1;
  wasteTypes: Record<WasteType, boolean>;
};

export type AppearancePreference = 'system' | 'light' | 'dark';

export type PlaceReminderPreferences = NotificationPreferences & {
  morningReminder: boolean;
  morningHour: number;
  secondReminder: boolean;
  secondReminderHour: number;
  collectionFollowUp: boolean;
  collectionChangeAlerts: boolean;
  disruptionAlerts: boolean;
  recollectionAlerts: boolean;
};

export type CollectionOutcomeStatus = 'put-out' | 'collected' | 'missed' | 'brought-in';

export type CollectionOutcome = {
  id: string;
  addressId: string;
  collectionId: string;
  collectionDate: string;
  wasteType: WasteType;
  status: CollectionOutcomeStatus;
  updatedAt: string;
};

export type CollectionLifecycleStage =
  | 'before'
  | 'morning'
  | 'in-progress'
  | 'awaiting-confirmation'
  | 'collected'
  | 'missed'
  | 'complete';

export type MissedReportStatus =
  | 'draft'
  | 'not-yet-eligible'
  | 'ready'
  | 'opened-council-service'
  | 'reported'
  | 'awaiting-response'
  | 'acknowledged'
  | 'recollection-scheduled'
  | 'resolved'
  | 'rejected'
  | 'cancelled'
  | 'closed';

export type ReportSubmissionMethod = 'direct-api' | 'council-website' | 'phone-or-email';

export type MissedCollectionReport = {
  id: string;
  localTrackingId: string;
  addressId: string;
  propertyAddress: string;
  postcode: string;
  councilName: string;
  providerId: string;
  councilAddressId?: string;
  collectionId: string;
  collectionDate: string;
  wasteType: WasteType;
  binLabel: string;
  reportType: 'missed_collection';
  status: MissedReportStatus;
  submissionMethod: ReportSubmissionMethod;
  officialServiceUrl: string;
  eligibilityCheckedAt: string;
  eligibleAfter: string;
  eligibilityResult: {
    eligible: boolean;
    reason: string;
    policySourceUrl?: string;
    expiresAt?: string;
  };
  lastCheckedAt: string;
  councilReference?: string;
  userUpdate?: string;
  expectedResponse?: string;
  expectedRecollectionDate?: string;
  statusSource?: 'resident' | 'council-provider';
  details: {
    putOutOnTime: boolean;
    accessibleToCrew: boolean;
    attachedNotice: boolean;
    stillOutside: boolean;
    contentsAccepted?: boolean;
    lidClosed?: boolean;
    notOverweight?: boolean;
    neighboursCollected: 'yes' | 'no' | 'unknown';
    knownServiceIssueChecked?: boolean;
    notes?: string;
    /** Legacy local records created before the guided eligibility questions were expanded. */
    leftAtCollectionPoint?: boolean;
    contaminationSticker?: boolean;
    accessBlocked?: boolean;
  };
  createdAt: string;
  updatedAt: string;
  reportedAt?: string;
  resolvedAt?: string;
};

export type DisruptionAlert = {
  id: string;
  addressId: string;
  title: string;
  detail: string;
  sourceUrl: string;
  startsAt: string;
  endsAt?: string;
  expectedRecollectionDate?: string;
  verifiedAt: string;
};

export type ActivityType =
  | 'address-added'
  | 'dates-refreshed'
  | 'bin-put-out'
  | 'collection-confirmed'
  | 'missed-collection'
  | 'report-opened'
  | 'report-updated'
  | 'feedback-saved';

export type ActivityEntry = {
  id: string;
  addressId?: string;
  type: ActivityType;
  title: string;
  detail?: string;
  occurredAt: string;
};

export type IncorrectDataFeedback = {
  id: string;
  addressId?: string;
  issue:
    | 'wrong-date'
    | 'wrong-bin'
    | 'missing-collection'
    | 'address-not-recognised'
    | 'wrong-council'
    | 'guide-problem'
    | 'service-problem'
    | 'other';
  detail: string;
  expectedValue?: string;
  technicalContext?: {
    appVersion: string;
    place?: string;
    postcode?: string;
    council?: string;
    providerId?: string;
    displayedDate?: string;
    lastRefreshAt?: string;
    online: boolean;
  };
  createdAt: string;
};

export type SupportRequest = {
  id: string;
  topic: 'app-help' | 'notifications' | 'address' | 'accessibility' | 'app-problem' | 'guide-item' | 'other';
  detail: string;
  createdAt: string;
};

export type ProviderResult = {
  councilName: string;
  providerId: string;
  collections: Collection[];
  verifiedAt: string;
  notice?: string;
  alerts?: Omit<DisruptionAlert, 'addressId'>[];
};
