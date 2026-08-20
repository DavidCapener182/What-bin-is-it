import { cookies, headers } from "next/headers";

import {
  consoleE2eFixtureEmail,
  consoleE2eFixtureIds,
  consoleE2eFixtureSessionCookie,
  consoleE2eFixtureSessionFor,
  consoleE2eFixtureSessionToken,
  consoleE2eFixtureStateCookie,
  consoleTestFixtureRequestEnabled,
  isConsoleE2eFixtureSession,
} from "./console-test-fixtures";
import {
  operationalQueueState,
  type OperationalQueueSearchParams,
  type OperationalQueueServerPage,
  type OperationalQueueState,
} from "./operational-queue";
import type {
  ResidentSupportMessage,
  ResidentSupportPriority,
  ResidentSupportStatus,
  ResidentSupportThread,
} from "./resident-support";
import type {
  CouncilAnnouncement,
  CouncilBroadcastSummary,
  CouncilBulkyBooking,
  CouncilDisruption,
  CouncilPartner,
  CouncilStaffSession,
} from "./types";

type FixtureAnnouncementState = Pick<CouncilAnnouncement, "body" | "status" | "title">;
type FixtureDisruptionState = Pick<CouncilDisruption, "detail" | "residentInstruction" | "startsAt" | "status" | "title">;

type ConsoleE2eFixtureState = {
  announcement?: FixtureAnnouncementState;
  bookingProviderReference?: string;
  bookingStatus?: "started" | "confirmed";
  disruption?: FixtureDisruptionState;
  partnerStatus?: "review" | "active";
  supportReply?: string;
};

const fixtureAnnouncement: CouncilAnnouncement = {
  id: consoleE2eFixtureIds.announcement,
  kind: "service",
  severity: "advice",
  title: "Bank holiday collection reminder",
  body: "Collections move by one day after the August bank holiday.",
  placements: ["home", "activity"],
  status: "draft",
  startsAt: "2026-08-24T08:00:00.000Z",
  endsAt: "2026-08-31T18:00:00.000Z",
  sourceUrl: "https://example.gov.uk/bank-holiday-collections",
  audience: { scope: "council", collectionTypes: [], collectionDates: [], audienceLabels: [] },
  updatedAt: "2026-08-20T09:00:00.000Z",
};

const fixtureDisruption: CouncilDisruption = {
  id: consoleE2eFixtureIds.disruption,
  title: "Recycling vehicle delay",
  detail: "A vehicle fault has delayed the Riverside recycling round.",
  collectionTypes: ["recycling"],
  areaLabels: ["Riverside round"],
  cause: "vehicle",
  residentInstruction: "Leave recycling containers out until 18:00 tomorrow.",
  status: "draft",
  startsAt: "2026-08-20T07:30:00.000Z",
  expectedResumeAt: "2026-08-21T12:00:00.000Z",
  endsAt: "2026-08-21T18:00:00.000Z",
  sourceUrl: "https://example.gov.uk/service-updates",
  audience: { scope: "council", collectionTypes: [], collectionDates: [], audienceLabels: [] },
  updatedAt: "2026-08-20T09:15:00.000Z",
};

const fixturePartner: CouncilPartner = {
  id: consoleE2eFixtureIds.partner,
  name: "Generated Bulky Waste Partner",
  category: "bulky-waste",
  description: "Generated test-only collection service awaiting council approval.",
  serviceUrl: "https://partner.example.test/book",
  itemKeys: ["sofa", "mattress"],
  disclosureLabel: "Paid partner collection",
  referralModel: "fixed-fee",
  commissionPence: 500,
  bookingMode: "external-referral",
  providerAcceptanceSlaHours: 24,
  termsUrl: "https://partner.example.test/terms",
  priority: 20,
  licenceReference: "E2E-WASTE-001",
  supportedAreaLabels: ["Council-wide"],
  complaintContact: "complaints@partner.example.test",
  evidenceUrl: "https://partner.example.test/evidence",
  renewalReviewAt: "2027-08-20",
  conversionCounts: { "listing-viewed": 42, "website-opened": 18, "booking-initiated": 7 },
  bookingCounts: { started: 1 },
  confirmedBookingValuePence: 0,
  confirmedPlatformFeePence: 0,
  status: "review",
  updatedAt: "2026-08-20T10:00:00.000Z",
};

const fixtureBooking: CouncilBulkyBooking = {
  reference: consoleE2eFixtureIds.booking,
  partnerId: consoleE2eFixtureIds.partner,
  partnerName: fixturePartner.name,
  channel: "external-referral",
  itemKey: "sofa",
  quantity: 1,
  status: "started",
  startedAt: "2026-08-20T10:15:00.000Z",
  payoutReleased: false,
  refunded: false,
};

async function requestHost() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
}

export async function consoleE2eFixturesAvailable() {
  return consoleTestFixtureRequestEnabled(process.env, await requestHost());
}

export async function consoleE2eFixtureSession() {
  const host = await requestHost();
  if (!consoleTestFixtureRequestEnabled(process.env, host)) return undefined;
  const cookieStore = await cookies();
  return consoleE2eFixtureSessionFor(
    cookieStore.get(consoleE2eFixtureSessionCookie)?.value,
    process.env,
    host,
  );
}

export async function startConsoleE2eFixtureSession(email: string) {
  if (!await consoleE2eFixturesAvailable() || email.trim().toLowerCase() !== consoleE2eFixtureEmail) {
    return false;
  }
  const cookieStore = await cookies();
  cookieStore.set(consoleE2eFixtureSessionCookie, consoleE2eFixtureSessionToken, {
    httpOnly: true,
    maxAge: 60 * 60,
    path: "/",
    sameSite: "strict",
    secure: false,
  });
  cookieStore.delete(consoleE2eFixtureStateCookie);
  return true;
}

export async function clearConsoleE2eFixtureSession() {
  const session = await consoleE2eFixtureSession();
  if (!session) return false;
  const cookieStore = await cookies();
  cookieStore.delete(consoleE2eFixtureSessionCookie);
  cookieStore.delete(consoleE2eFixtureStateCookie);
  return true;
}

function boundedString(value: unknown, maximum: number) {
  return typeof value === "string" ? value.slice(0, maximum) : undefined;
}

function parseFixtureState(value?: string): ConsoleE2eFixtureState {
  if (!value) return {};
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    const announcement = parsed.announcement && typeof parsed.announcement === "object"
      ? parsed.announcement as Record<string, unknown>
      : undefined;
    const disruption = parsed.disruption && typeof parsed.disruption === "object"
      ? parsed.disruption as Record<string, unknown>
      : undefined;
    const announcementStatus = announcement?.status;
    const disruptionStatus = disruption?.status;
    return {
      announcement: announcement
        && typeof announcement.title === "string"
        && typeof announcement.body === "string"
        && ["draft", "published", "archived"].includes(String(announcementStatus))
        ? {
            title: announcement.title.slice(0, 120),
            body: announcement.body.slice(0, 600),
            status: String(announcementStatus),
          }
        : undefined,
      bookingProviderReference: boundedString(parsed.bookingProviderReference, 160),
      bookingStatus: parsed.bookingStatus === "confirmed" ? "confirmed" : undefined,
      disruption: disruption
        && typeof disruption.title === "string"
        && typeof disruption.detail === "string"
        && typeof disruption.residentInstruction === "string"
        && typeof disruption.startsAt === "string"
        && ["draft", "published", "resolved", "archived"].includes(String(disruptionStatus))
        ? {
            title: disruption.title.slice(0, 120),
            detail: disruption.detail.slice(0, 600),
            residentInstruction: disruption.residentInstruction.slice(0, 400),
            startsAt: disruption.startsAt.slice(0, 40),
            status: String(disruptionStatus),
          }
        : undefined,
      partnerStatus: parsed.partnerStatus === "active" ? "active" : undefined,
      supportReply: boundedString(parsed.supportReply, 1_000),
    } as ConsoleE2eFixtureState;
  } catch {
    return {};
  }
}

async function fixtureState() {
  const session = await consoleE2eFixtureSession();
  if (!session) throw new Error("The local council E2E fixture session is not available.");
  const cookieStore = await cookies();
  return parseFixtureState(cookieStore.get(consoleE2eFixtureStateCookie)?.value);
}

async function writeFixtureState(next: ConsoleE2eFixtureState) {
  const session = await consoleE2eFixtureSession();
  if (!session) throw new Error("The local council E2E fixture session is not available.");
  const encoded = Buffer.from(JSON.stringify(next), "utf8").toString("base64url");
  if (encoded.length > 3_500) throw new Error("The generated council E2E fixture state is too large.");
  const cookieStore = await cookies();
  cookieStore.set(consoleE2eFixtureStateCookie, encoded, {
    httpOnly: true,
    maxAge: 60 * 60,
    path: "/",
    sameSite: "strict",
    secure: false,
  });
}

function serverPage<T>(state: OperationalQueueState<T>): OperationalQueueServerPage<T> {
  return {
    items: state.items,
    request: {
      direction: state.direction,
      filter: state.filter,
      offset: (state.page - 1) * state.pageSize,
      page: state.page,
      pageSize: state.pageSize,
      query: state.query,
      sort: state.sort,
      status: state.status,
    },
    total: state.total,
    unfilteredTotal: state.unfilteredTotal,
  };
}

export async function consoleE2eAnnouncementsPage(searchParams: OperationalQueueSearchParams) {
  const state = await fixtureState();
  const item = { ...fixtureAnnouncement, ...state.announcement };
  return serverPage(operationalQueueState([item], searchParams, {
    defaultDirection: "desc",
    defaultSort: "updated",
    filterValues: ["service", "education", "emergency", "seasonal"],
    getFilter: (entry) => entry.kind,
    getSearchText: (entry) => `${entry.title} ${entry.body} ${entry.kind} ${entry.severity} ${entry.placements.join(" ")}`,
    getStatus: (entry) => entry.status,
    sorts: { status: (entry) => entry.status, title: (entry) => entry.title, updated: (entry) => entry.updatedAt },
    statusValues: ["published", "scheduled", "draft", "archived"],
  }));
}

export async function consoleE2eDisruptionsPage(searchParams: OperationalQueueSearchParams) {
  const state = await fixtureState();
  const item = { ...fixtureDisruption, ...state.disruption };
  return serverPage(operationalQueueState([item], searchParams, {
    defaultDirection: "desc",
    defaultSort: "starts",
    filterValues: ["operational", "weather", "bank-holiday", "industrial-action", "vehicle", "emergency", "other"],
    getFilter: (entry) => entry.cause,
    getSearchText: (entry) => `${entry.title} ${entry.detail} ${entry.residentInstruction} ${entry.collectionTypes.join(" ")} ${entry.areaLabels.join(" ")} ${entry.cause}`,
    getStatus: (entry) => entry.status,
    sorts: { starts: (entry) => entry.startsAt, status: (entry) => entry.status, title: (entry) => entry.title },
    statusValues: ["published", "draft", "resolved", "archived"],
  }));
}

export async function consoleE2eActiveDisruptions() {
  const state = await fixtureState();
  const item = { ...fixtureDisruption, ...state.disruption };
  return item.status === "published"
    ? [{ id: item.id, title: item.title, startsAt: item.startsAt, endsAt: item.endsAt }]
    : [];
}

export async function consoleE2eAnnouncementTitles() {
  const state = await fixtureState();
  return [{ ...fixtureAnnouncement, ...state.announcement }.title];
}

export async function consoleE2eDisruptionTitles() {
  const state = await fixtureState();
  return [{ ...fixtureDisruption, ...state.disruption }.title];
}

export function consoleE2eBroadcasts(): CouncilBroadcastSummary[] {
  return [];
}

export async function consoleE2ePartnersPage(searchParams: OperationalQueueSearchParams) {
  const state = await fixtureState();
  const item = { ...fixturePartner, status: state.partnerStatus ?? fixturePartner.status };
  const categories = [item.category];
  const page = serverPage(operationalQueueState([item], searchParams, {
    defaultSort: "name",
    filterValues: categories,
    getFilter: (entry) => entry.category,
    getSearchText: (entry) => `${entry.name} ${entry.category} ${entry.description} ${entry.licenceReference ?? ""} ${entry.supportedAreaLabels.join(" ")}`,
    getStatus: (entry) => entry.status,
    sorts: {
      bookings: (entry) => entry.conversionCounts["booking-confirmed"] ?? 0,
      name: (entry) => entry.name,
      priority: (entry) => entry.priority,
      review: (entry) => entry.renewalReviewAt,
    },
    statusValues: ["draft", "review", "active", "paused", "ended"],
  }));
  return { ...page, categories };
}

export async function consoleE2eBookingsPage(searchParams: OperationalQueueSearchParams) {
  const state = await fixtureState();
  const item: CouncilBulkyBooking = {
    ...fixtureBooking,
    status: state.bookingStatus ?? fixtureBooking.status,
    providerReference: state.bookingProviderReference,
    confirmedAt: state.bookingStatus === "confirmed" ? "2026-08-20T12:00:00.000Z" : undefined,
  };
  return serverPage(operationalQueueState([item], searchParams, {
    defaultDirection: "desc",
    defaultSort: "started",
    filterValues: ["official-council", "external-referral", "stripe-connect"],
    getFilter: (entry) => entry.channel,
    getSearchText: (entry) => `${entry.reference} ${entry.partnerName ?? ""} ${entry.providerReference ?? ""} ${entry.itemKey} ${entry.channel}`,
    getStatus: (entry) => entry.status,
    sorts: {
      amount: (entry) => entry.amountPence,
      partner: (entry) => entry.partnerName ?? "Official council route",
      started: (entry) => entry.startedAt,
      status: (entry) => entry.status,
    },
    statusValues: [
      "official-handoff", "started", "checkout-created", "payment-pending", "awaiting-provider",
      "provider-accepted", "scheduled", "confirmed", "completed", "payout-released",
      "provider-declined", "cancelled", "refunded", "payment-failed",
    ],
  }));
}

function supportMessages(state: ConsoleE2eFixtureState): ResidentSupportMessage[] {
  const messages: ResidentSupportMessage[] = [{
    id: consoleE2eFixtureIds.supportMessage,
    sender: "resident",
    visibility: "resident",
    body: "My recycling was not collected yesterday. Should I leave it out?",
    createdAt: "2026-08-20T08:30:00.000Z",
  }];
  if (state.supportReply) {
    messages.push({
      id: consoleE2eFixtureIds.supportReply,
      sender: "support",
      visibility: "resident",
      body: state.supportReply,
      createdAt: "2026-08-20T11:30:00.000Z",
    });
  }
  return messages;
}

function supportThread(state: ConsoleE2eFixtureState): ResidentSupportThread {
  const replied = Boolean(state.supportReply);
  return {
    id: consoleE2eFixtureIds.supportThread,
    residentReference: "Resident E2E00001",
    councilProviderId: "council-e2e-provider",
    councilName: "Generated E2E Council",
    topic: "missed-collection",
    subject: "Recycling collection missed",
    status: replied ? "waiting-resident" : "new",
    priority: "high",
    escalationStatus: "none",
    assignedStaffId: consoleE2eFixtureIds.user,
    assignedStaffLabel: consoleE2eFixtureEmail,
    slaDueAt: "2099-08-21T12:00:00.000Z",
    topicTags: ["recycling", "missed-collection"],
    reopenedCount: 0,
    firstRespondedAt: replied ? "2026-08-20T11:30:00.000Z" : undefined,
    lastSender: replied ? "support" : "resident",
    lastMessageAt: replied ? "2026-08-20T11:30:00.000Z" : "2026-08-20T08:30:00.000Z",
    createdAt: "2026-08-20T08:30:00.000Z",
    messages: supportMessages(state),
    messageHistory: { page: 1, pageCount: 1, pageSize: 50, total: replied ? 2 : 1 },
  };
}

export async function consoleE2eSupportThreadsPage(searchParams: OperationalQueueSearchParams) {
  const state = await fixtureState();
  const item = supportThread(state);
  return serverPage(operationalQueueState([item], searchParams, {
    defaultDirection: "desc",
    defaultSort: "updated",
    filterValues: ["low", "normal", "high", "urgent"] satisfies ResidentSupportPriority[],
    getFilter: (entry) => entry.priority,
    getSearchText: (entry) => `${entry.subject} ${entry.residentReference} ${entry.councilName ?? ""} ${entry.topicTags.join(" ")}`,
    getStatus: (entry) => entry.status,
    sorts: {
      priority: (entry) => entry.priority,
      sla: (entry) => entry.slaDueAt,
      status: (entry) => entry.status,
      updated: (entry) => entry.lastMessageAt,
    },
    statusValues: ["new", "in-progress", "waiting-resident", "waiting-operations", "resolved", "closed"] satisfies ResidentSupportStatus[],
  }));
}

export async function consoleE2eSupportThread(threadId: string) {
  const state = await fixtureState();
  return threadId === consoleE2eFixtureIds.supportThread ? supportThread(state) : undefined;
}

export function consoleE2eSupportStaff() {
  return [{ userId: consoleE2eFixtureIds.user, label: consoleE2eFixtureEmail, role: "owner" }];
}

export function consoleE2eSavedResponses() {
  return [{
    id: "a0000000-0000-4000-8000-000000000010",
    title: "Leave the container out",
    body: "Please leave the container out. The collection crew will return by 18:00 tomorrow.",
    topicTags: ["missed-collection"],
  }];
}

export function consoleE2eSupportMetrics() {
  return {
    newCount: 1,
    overdueCount: 0,
    medianFirstResponseHours: undefined,
    medianResolutionHours: undefined,
    reopenedCount: 0,
    topThemes: [["missed-collection", 1]] as Array<[string, number]>,
  };
}

export async function saveConsoleE2eAnnouncement(input: FixtureAnnouncementState) {
  const state = await fixtureState();
  await writeFixtureState({
    ...state,
    announcement: { title: input.title, body: input.body, status: input.status },
  });
}

export async function setConsoleE2eAnnouncementStatus(id: string, status: "published" | "archived") {
  if (id !== consoleE2eFixtureIds.announcement) throw new Error("The announcement was not found.");
  const state = await fixtureState();
  const current = { ...fixtureAnnouncement, ...state.announcement };
  await writeFixtureState({ ...state, announcement: { title: current.title, body: current.body, status } });
}

export async function saveConsoleE2eDisruption(input: FixtureDisruptionState) {
  const state = await fixtureState();
  await writeFixtureState({
    ...state,
    disruption: {
      title: input.title,
      detail: input.detail,
      residentInstruction: input.residentInstruction,
      startsAt: input.startsAt,
      status: input.status,
    },
  });
}

export async function setConsoleE2eDisruptionStatus(
  id: string,
  status: "published" | "resolved" | "archived",
) {
  if (id !== consoleE2eFixtureIds.disruption) throw new Error("The disruption was not found.");
  const state = await fixtureState();
  const current = { ...fixtureDisruption, ...state.disruption };
  await writeFixtureState({
    ...state,
    disruption: {
      title: current.title,
      detail: current.detail,
      residentInstruction: current.residentInstruction,
      startsAt: current.startsAt,
      status,
    },
  });
}

export async function setConsoleE2ePartnerStatus(id: string, status: "active" | "paused" | "ended") {
  if (id !== consoleE2eFixtureIds.partner || status !== "active") {
    throw new Error("The generated partner fixture supports only the review-to-active journey.");
  }
  const state = await fixtureState();
  await writeFixtureState({ ...state, partnerStatus: "active" });
}

export async function confirmConsoleE2eBooking(reference: string, providerReference: string) {
  if (reference !== consoleE2eFixtureIds.booking) throw new Error("The booking was not found.");
  const state = await fixtureState();
  await writeFixtureState({
    ...state,
    bookingProviderReference: providerReference,
    bookingStatus: "confirmed",
  });
}

export async function replyToConsoleE2eSupport(threadId: string, body: string) {
  if (threadId !== consoleE2eFixtureIds.supportThread) throw new Error("The conversation was not found.");
  const state = await fixtureState();
  await writeFixtureState({ ...state, supportReply: body.slice(0, 1_000) });
}

export { isConsoleE2eFixtureSession };
export type { CouncilStaffSession };
