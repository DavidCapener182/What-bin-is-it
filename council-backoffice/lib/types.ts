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
  updatedAt: string;
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
  priority: number;
  licenceReference?: string;
  status: string;
  startsAt?: string;
  endsAt?: string;
  updatedAt: string;
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
