export const councilRoles = ["owner", "admin", "editor", "analyst", "support"] as const;
export type CouncilRole = (typeof councilRoles)[number];

export type CouncilPermission =
  | "dashboard:view"
  | "content:write"
  | "content:publish"
  | "guidance:write"
  | "partners:write"
  | "partners:approve"
  | "reports:write"
  | "support:view"
  | "support:reply"
  | "analytics:view"
  | "analytics:export"
  | "audit:view"
  | "organisation:manage";

export type CouncilOrganisation = {
  id: string;
  providerId: string;
  slug: string;
  name: string;
  status: "prospect" | "pilot" | "active" | "suspended" | "ended";
  planTier: "pilot" | "core" | "professional" | "enterprise";
  brandName?: string;
  logoUrl?: string;
  primaryColour: string;
  secondaryColour: string;
  sponsorshipLabel?: string;
};

export type CouncilStaffSession = {
  userId: string;
  email?: string;
  staffId: string;
  role: CouncilRole;
  platformAdmin: boolean;
  organisation: CouncilOrganisation;
};

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  state: "available" | "suppressed" | "not-connected";
  tone?: "blue" | "teal" | "amber" | "red";
};

export type OutcomeFunnelStage = {
  label: string;
  value: number;
  detail: string;
};

export type CouncilOutcomeFunnels = {
  collection: OutcomeFunnelStage[];
  guide: OutcomeFunnelStage[];
  communications: OutcomeFunnelStage[];
};

export type CouncilPilotBaseline = {
  periodStartsOn: string;
  periodEndsOn: string;
  agreedContactCostPence?: number;
  residentContacts?: number;
  missedCollectionContacts?: number;
  notes?: string;
  updatedAt: string;
};

export type CouncilAudienceCriteria = {
  scope: "council" | "targeted";
  collectionTypes: string[];
  collectionDates: string[];
  audienceLabels: string[];
};

export type CouncilAnnouncement = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
  placements: string[];
  status: string;
  startsAt?: string;
  endsAt?: string;
  sourceUrl?: string;
  audience: CouncilAudienceCriteria;
  updatedAt: string;
};

export type CouncilDisruption = {
  id: string;
  title: string;
  detail: string;
  collectionTypes: string[];
  areaLabels: string[];
  cause: string;
  residentInstruction: string;
  status: string;
  startsAt: string;
  expectedResumeAt?: string;
  endsAt?: string;
  sourceUrl?: string;
  audience: CouncilAudienceCriteria;
  updatedAt: string;
};

export type CouncilBroadcastSummary = {
  id: string;
  contentId: string;
  status: string;
  acceptedCount: number;
  failedCount: number;
  estimatedRecipientCount: number;
  audience: CouncilAudienceCriteria;
  requestedAt: string;
  completedAt?: string;
};

export type CouncilGuidanceItem = {
  id: string;
  itemKey: string;
  itemName: string;
  searchTerms: string[];
  destination: string;
  heading: string;
  detail: string;
  serviceUrl?: string;
  status: string;
  updatedAt: string;
};

export type CouncilPartner = {
  id: string;
  name: string;
  category: string;
  description: string;
  serviceUrl: string;
  itemKeys: string[];
  disclosureLabel: string;
  referralModel: string;
  commissionPence?: number;
  bookingMode: "none" | "external-referral" | "stripe-connect";
  bookingPricePence?: number;
  platformFeePence?: number;
  stripeAccountId?: string;
  providerAcceptanceSlaHours: number;
  termsUrl?: string;
  priority: number;
  licenceReference?: string;
  supportedAreaLabels: string[];
  complaintContact?: string;
  evidenceUrl?: string;
  budgetPence?: number;
  suspensionReason?: string;
  renewalReviewAt?: string;
  conversionCounts: Record<string, number>;
  bookingCounts: Record<string, number>;
  confirmedBookingValuePence: number;
  confirmedPlatformFeePence: number;
  status: string;
  startsAt?: string;
  endsAt?: string;
  updatedAt: string;
};

export type CouncilBulkyBooking = {
  reference: string;
  partnerId?: string;
  partnerName?: string;
  channel: "official-council" | "external-referral" | "stripe-connect";
  itemKey: string;
  quantity: number;
  amountPence?: number;
  platformFeePence?: number;
  status: string;
  providerReference?: string;
  paymentIntentId?: string;
  startedAt: string;
  confirmedAt?: string;
  providerAcceptedAt?: string;
  providerDeclinedAt?: string;
  scheduledFor?: string;
  completedAt?: string;
  payoutReleasedAt?: string;
  refundedAt?: string;
  payoutReleased: boolean;
  refunded: boolean;
};

export type CouncilSponsorshipProgramme = {
  id: string;
  sponsorType: "council" | "housing";
  status: "draft" | "active" | "paused" | "ended";
  residentLabel: string;
  features: string[];
  startsAt: string;
  endsAt?: string;
  renewalAt?: string;
  createdAt: string;
};

export type CouncilFeatureFlags = {
  collectionDates: boolean;
  councilBranding: boolean;
  pushAlerts: boolean;
  missedCollection: boolean;
  directReporting: boolean;
  recyclingGuide: boolean;
  partnerServices: boolean;
  supportInbox: boolean;
  sponsoredPlus: boolean;
  analyticsExports: boolean;
  bulkyWasteBooking: boolean;
};

export type CouncilOnboardingItem = {
  itemKey: string;
  status: "not-started" | "in-progress" | "complete" | "blocked";
  evidenceNote?: string;
  completedAt?: string;
};

export type ReportingRule = {
  enabled: boolean;
  mode: "official-handoff" | "direct-api" | "disabled";
  reportUrl?: string;
  eligibilityStartsHours: number;
  reportingDeadlineHours: number;
  requireDelayCheck: boolean;
  residentInstruction?: string;
  integrationSecretRef?: string;
  updatedAt?: string;
};

export type AuditEvent = {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: Record<string, unknown>;
  occurredAt: string;
};

export const crmAccountTypes = ["council", "sponsor", "partner", "enterprise"] as const;
export type CrmAccountType = (typeof crmAccountTypes)[number];

export const crmStages = [
  "lead",
  "contacted",
  "discovery",
  "proposal",
  "pilot",
  "won",
  "lost",
  "paused",
] as const;
export type CrmStage = (typeof crmStages)[number];

export type CrmAccount = {
  id: string;
  accountType: CrmAccountType;
  name: string;
  councilOrganisationId?: string;
  websiteUrl?: string;
  stage: CrmStage;
  annualValuePence?: number;
  summary?: string;
  ownerUserId?: string;
  lastContactAt?: string;
  nextFollowUpAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmContact = {
  id: string;
  accountId: string;
  fullName: string;
  jobTitle?: string;
  professionalEmail?: string;
  professionalPhone?: string;
  linkedinUrl?: string;
  preferredChannel: "email" | "phone" | "linkedin" | "meeting" | "none";
  lawfulBasis: "legitimate-interests" | "consent" | "contract" | "public-task";
  source: string;
  doNotContact: boolean;
  retentionReviewAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmActivity = {
  id: string;
  accountId: string;
  contactId?: string;
  contactName?: string;
  kind: "email" | "call" | "meeting" | "note" | "proposal" | "demo" | "task-update";
  direction: "inbound" | "outbound" | "internal";
  subject: string;
  summary: string;
  occurredAt: string;
  nextStep?: string;
  nextFollowUpAt?: string;
  createdAt: string;
};

export type CrmTask = {
  id: string;
  accountId: string;
  contactId?: string;
  contactName?: string;
  title: string;
  dueAt?: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in-progress" | "completed" | "cancelled";
  completedAt?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmChannel = "email" | "phone" | "sms" | "linkedin" | "meeting" | "note";

export type CrmMessage = {
  id: string;
  threadId: string;
  accountId: string;
  accountName: string;
  contactId?: string;
  contactName?: string;
  direction: "sent" | "received" | "internal";
  channel: CrmChannel;
  senderAddress?: string;
  recipientAddresses: string[];
  subject: string;
  body: string;
  occurredAt: string;
  deliveryStatus: "draft" | "sent" | "delivered" | "received" | "read" | "failed";
  externalMessageId?: string;
  attachmentNames: string[];
  createdAt: string;
};

export type CrmThread = {
  id: string;
  accountId: string;
  accountName: string;
  contactId?: string;
  contactName?: string;
  channel: CrmChannel;
  subject: string;
  status: "open" | "waiting" | "closed" | "archived";
  lastMessageAt?: string;
  lastDirection?: "sent" | "received" | "internal";
  messageCount: number;
};

export type CrmMailboxConnection = {
  id: string;
  provider: "gmail" | "outlook";
  mailboxEmail: string;
  status: "disconnected" | "pending" | "active" | "error" | "revoked";
  lastSyncedAt?: string;
  lastErrorCode?: string;
};
