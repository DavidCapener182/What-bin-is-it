"use server";

import { createHash } from "node:crypto";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  authenticatedCouncilIdentity,
  clearDevelopmentSuperadminSession,
  councilMemberships,
  requireCouncilAction,
  requirePlatformAdminAction,
  startDevelopmentSuperadminSession,
} from "@/lib/auth";
import {
  createCrmAccount,
  createCrmActivity,
  createCrmContact,
  createCrmMessage,
  createCrmTask,
  updateCrmAccountStage,
  updateCrmTaskStatus,
} from "@/lib/crm";
import { councilDatabase } from "@/lib/database";
import { requestCouncilBroadcast } from "@/lib/broadcasts";
import {
  createAnnouncement,
  createDisruption,
  createPartner,
  createSponsorshipProgramme,
  confirmExternalBulkyBooking,
  saveCouncilFeatureFlags,
  saveCouncilPilotBaseline,
  saveCouncilOnboardingItem,
  saveReportingRule,
  setAnnouncementStatus,
  setDisruptionStatus,
  setPartnerStatus,
  setSponsorshipProgrammeStatus,
  updateOrganisationBrand,
  upsertGuidance,
} from "@/lib/data";
import { assertCouncilPermission } from "@/lib/permissions";
import {
  addResidentSupportInternalNote,
  createResidentSupportSavedResponse,
  replyToResidentSupportThread,
  setResidentSupportThreadStatus,
  updateResidentSupportCase,
} from "@/lib/resident-support";
import { createCouncilSupabaseServerClient } from "@/lib/supabase/server";
import type { CouncilAudienceCriteria } from "@/lib/types";
import { createPlatformIncident, updatePlatformIncidentStatus } from "@/lib/platform-status";
import {
  assertUuid,
  integerValue,
  isoDate,
  isoDateTime,
  normaliseItemKey,
  optionalText,
  requiredText,
  safeEmail,
  safeHttpsUrl,
  safeReturnPath,
  selectedValues,
  splitValues,
} from "@/lib/validation";

function errorPath(path: string, error: unknown) {
  const operationalError = typeof error === "object" && error !== null && (
    "code" in error
    || "severity" in error
    || "detail" in error
    || "routine" in error
    || "constraint" in error
  );
  const message = !operationalError && error instanceof Error
    ? error.message
    : "The change could not be saved. Check the values and try again.";
  return `${path}?error=${encodeURIComponent(message.slice(0, 180))}`;
}

function successPath(path: string, message: string) {
  return `${path}?saved=${encodeURIComponent(message)}`;
}

function allowedValue<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
  label: string,
) {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${label} is invalid.`);
  }
  return value as T;
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "yes";
}

function broadcastAudience(
  formData: FormData,
  defaultCollectionTypes: string[] = [],
): CouncilAudienceCriteria {
  const scope = allowedValue(formData.get("audienceScope"), ["council", "targeted"] as const, "Audience");
  const collectionTypes = selectedValues(formData, "audienceCollectionTypes");
  const types = collectionTypes.length ? collectionTypes : defaultCollectionTypes.filter((type) => type !== "all");
  if (types.some((type) => !["general", "recycling", "garden", "food", "other"].includes(type))) {
    throw new Error("Choose supported collection types for the audience.");
  }
  const collectionDates = splitValues(formData.get("audienceCollectionDates"), 24, 10);
  collectionDates.forEach((date) => isoDate(date, true));
  const audienceLabels = splitValues(formData.get("audienceLabels"), 24, 80);
  if (scope === "targeted" && !types.length && !collectionDates.length && !audienceLabels.length) {
    throw new Error("A targeted alert needs a collection type, collection date or approved audience label.");
  }
  return {
    scope,
    collectionTypes: scope === "targeted" ? types : [],
    collectionDates: scope === "targeted" ? collectionDates : [],
    audienceLabels: scope === "targeted" ? audienceLabels : [],
  };
}

function assertAudienceConfirmed(formData: FormData, sendPush: boolean) {
  if (sendPush && !checked(formData, "confirmAudience")) {
    throw new Error("Confirm the audience preview before sending a push alert.");
  }
}

async function broadcastMessage(jobId: string | undefined, fallback: string) {
  if (!jobId) return fallback;
  try {
    const result = await requestCouncilBroadcast(jobId);
    return `${fallback} Push accepted for ${result.accepted} opted-in device${result.accepted === 1 ? "" : "s"}${result.failed ? `; ${result.failed} failed or expired` : ""}.`;
  } catch {
    return `${fallback} The in-app alert is live; push remains queued for delivery.`;
  }
}

async function signInOrigin() {
  const configured = process.env.COUNCIL_BACKOFFICE_URL?.trim();
  const requestHeaders = await headers();
  const requestOrigin = requestHeaders.get("origin");
  const allowed = new Set(
    (process.env.COUNCIL_BACKOFFICE_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (configured) allowed.add(configured);
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3010");
    allowed.add("http://127.0.0.1:3010");
  }
  const candidate = requestOrigin && allowed.has(requestOrigin)
    ? requestOrigin
    : configured;
  if (!candidate) throw new Error("Council sign-in redirects are not configured.");
  const url = new URL(candidate);
  if (
    (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
    || url.username
    || url.password
  ) {
    throw new Error("The council sign-in origin is invalid.");
  }
  return url.origin;
}

async function allowSignInAttempt(
  email: string,
  purpose: "magic-link" | "password",
  minimumIntervalMs: number,
  maximumAttempts: number,
) {
  const sql = councilDatabase();
  const emailHash = createHash("sha256").update(`${purpose}:${email}`).digest("hex");
  return sql.begin(async (transaction) => {
    await transaction`
      DELETE FROM bin_council_auth_rate_limits
      WHERE expires_at < now()
    `;
    const rows = await transaction<{
      window_started_at: Date;
      request_count: number;
      last_requested_at: Date | null;
    }[]>`
      SELECT window_started_at, request_count, last_requested_at
      FROM bin_council_auth_rate_limits
      WHERE email_hash = ${emailHash}
      FOR UPDATE
    `;
    const current = rows[0];
    const now = Date.now();
    if (current?.last_requested_at && now - current.last_requested_at.getTime() < minimumIntervalMs) {
      return false;
    }
    const windowIsCurrent = Boolean(
      current && now - current.window_started_at.getTime() < 60 * 60 * 1_000,
    );
    const nextCount = windowIsCurrent ? current.request_count + 1 : 1;
    if (nextCount > maximumAttempts) return false;
    await transaction`
      INSERT INTO bin_council_auth_rate_limits (
        email_hash,
        window_started_at,
        request_count,
        last_requested_at,
        expires_at
      ) VALUES (
        ${emailHash},
        now(),
        1,
        now(),
        now() + interval '24 hours'
      )
      ON CONFLICT (email_hash) DO UPDATE SET
        window_started_at = CASE
          WHEN ${windowIsCurrent} THEN bin_council_auth_rate_limits.window_started_at
          ELSE now()
        END,
        request_count = ${nextCount},
        last_requested_at = now(),
        expires_at = now() + interval '24 hours'
    `;
    return true;
  });
}

async function authorisedCouncilEmail(email: string) {
  const sql = councilDatabase();
  const rows = await sql<{ authorised: boolean }[]>`
    SELECT (
      EXISTS (
        SELECT 1
        FROM auth.users AS user_account
        INNER JOIN bin_council_staff AS staff
          ON staff.user_id = user_account.id
        INNER JOIN bin_council_organisations AS organisation
          ON organisation.id = staff.organisation_id
        WHERE lower(user_account.email) = ${email}
          AND staff.status = 'active'
          AND organisation.status IN ('pilot', 'active')
      )
      OR EXISTS (
        SELECT 1
        FROM auth.users AS user_account
        INNER JOIN bin_council_platform_admins AS platform_admin
          ON platform_admin.user_id = user_account.id
        WHERE lower(user_account.email) = ${email}
          AND platform_admin.status = 'active'
      )
    ) AS authorised
  `;
  return rows[0]?.authorised === true;
}

export async function requestCouncilSignIn(formData: FormData) {
  const email = requiredText(formData.get("email"), "Email", 254).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/login?sent=1");
  let developmentSessionStarted = false;
  try {
    developmentSessionStarted = await startDevelopmentSuperadminSession(email);
  } catch {
    // Local convenience access fails closed and the verified email flow remains available.
  }
  if (developmentSessionStarted) redirect("/");
  try {
    const permitted = await allowSignInAttempt(email, "magic-link", 60_000, 5);
    const authorised = permitted && await authorisedCouncilEmail(email);
    if (authorised) {
      const supabase = await createCouncilSupabaseServerClient();
      const origin = await signInOrigin();
      await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          shouldCreateUser: false,
        },
      });
    }
  } catch {
    // The response remains generic to prevent email-account enumeration.
  }
  redirect("/login?sent=1");
}

export async function signInCouncilWithPassword(formData: FormData) {
  const emailEntry = formData.get("email");
  const passwordEntry = formData.get("password");
  const email = typeof emailEntry === "string" ? emailEntry.trim().toLowerCase() : "";
  const password = typeof passwordEntry === "string" ? passwordEntry : "";
  const validInput = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    && email.length <= 254
    && password.length >= 8
    && password.length <= 256;
  let authenticated = false;

  if (validInput) {
    try {
      const permitted = await allowSignInAttempt(email, "password", 1_500, 10);
      const authorised = permitted && await authorisedCouncilEmail(email);
      if (authorised) {
        const supabase = await createCouncilSupabaseServerClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        authenticated = !error;
      }
    } catch {
      // Keep failures generic so staff records and authentication state are not disclosed.
    }
  }

  if (authenticated) redirect("/");
  redirect("/login?auth=invalid");
}

export async function signOutCouncil() {
  const supabase = await createCouncilSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  await clearDevelopmentSuperadminSession();
  const cookieStore = await cookies();
  cookieStore.delete("what-bin-council-org");
  redirect("/login?signedOut=1");
}

export async function switchCouncil(formData: FormData) {
  const identity = await authenticatedCouncilIdentity();
  if (!identity) redirect("/login");
  const organisationId = assertUuid(requiredText(formData.get("organisationId"), "Council", 36));
  const memberships = await councilMemberships(identity.userId);
  if (!memberships.some((membership) => membership.organisation_id === organisationId)) {
    throw new Error("That council is not assigned to your account.");
  }
  const cookieStore = await cookies();
  cookieStore.set("what-bin-council-org", organisationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  const returnTo = safeReturnPath(optionalText(formData.get("returnTo"), 200));
  redirect(returnTo);
}

export async function saveAnnouncementAction(formData: FormData) {
  const path = "/announcements";
  let savedMessage = "Announcement saved.";
  try {
    const status = allowedValue(formData.get("status"), ["draft", "published"] as const, "Status");
    const sendPush = status === "published" && checked(formData, "sendPush");
    const session = await requireCouncilAction("content:write");
    if (status === "published") assertCouncilPermission(session.role, "content:publish");
    const placements = selectedValues(formData, "placements");
    const supportedPlacements = placements.filter((placement) => (
      placement === "home" || placement === "schedule" || placement === "guide" || placement === "activity"
    ));
    if (!supportedPlacements.length || supportedPlacements.length !== placements.length) {
      throw new Error("Choose at least one currently supported resident surface.");
    }
    const startsAt = isoDateTime(formData.get("startsAt"));
    if (sendPush && startsAt && new Date(startsAt) > new Date()) {
      throw new Error("A push alert must start now. Remove its future start time or save a draft.");
    }
    assertAudienceConfirmed(formData, sendPush);
    const result = await createAnnouncement(session, {
      kind: allowedValue(formData.get("kind"), ["service", "education", "emergency", "seasonal"] as const, "Message type"),
      severity: allowedValue(formData.get("severity"), ["information", "advice", "warning", "critical"] as const, "Severity"),
      title: requiredText(formData.get("title"), "Title", 120),
      body: requiredText(formData.get("body"), "Message", 600),
      placements: sendPush ? [...supportedPlacements, "push"] : supportedPlacements,
      startsAt,
      endsAt: isoDateTime(formData.get("endsAt")),
      sourceUrl: safeHttpsUrl(formData.get("sourceUrl")),
      audience: broadcastAudience(formData),
      status,
      sendPush,
    });
    savedMessage = await broadcastMessage(result.broadcastJobId, "Announcement saved.");
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, savedMessage));
}

export async function changeAnnouncementStatusAction(formData: FormData) {
  const path = "/announcements";
  let savedMessage = "Announcement status updated.";
  try {
    const status = allowedValue(formData.get("status"), ["published", "archived"] as const, "Status");
    const session = await requireCouncilAction("content:publish");
    const sendPush = status === "published" && checked(formData, "sendPush");
    assertAudienceConfirmed(formData, sendPush);
    const jobId = await setAnnouncementStatus(
      session,
      assertUuid(requiredText(formData.get("id"), "Announcement", 36)),
      status,
      sendPush,
    );
    savedMessage = await broadcastMessage(jobId, "Announcement status updated.");
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, savedMessage));
}

export async function saveDisruptionAction(formData: FormData) {
  const path = "/disruptions";
  let savedMessage = "Service disruption saved.";
  try {
    const status = allowedValue(formData.get("status"), ["draft", "published"] as const, "Status");
    const sendPush = status === "published" && checked(formData, "sendPush");
    const session = await requireCouncilAction("content:write");
    if (status === "published") assertCouncilPermission(session.role, "content:publish");
    const collectionTypes = selectedValues(formData, "collectionTypes");
    const supportedCollectionTypes = new Set(["all", "general", "recycling", "garden", "food", "other"]);
    if (
      !collectionTypes.length
      || collectionTypes.length > 6
      || collectionTypes.some((collectionType) => !supportedCollectionTypes.has(collectionType))
    ) {
      throw new Error("Select at least one supported collection type.");
    }
    const startsAt = isoDateTime(formData.get("startsAt"), true)!;
    if (sendPush && new Date(startsAt) > new Date()) {
      throw new Error("A push alert must start now. Change its start time or save a draft.");
    }
    assertAudienceConfirmed(formData, sendPush);
    const result = await createDisruption(session, {
      title: requiredText(formData.get("title"), "Title", 120),
      detail: requiredText(formData.get("detail"), "Details", 600),
      collectionTypes,
      areaLabels: splitValues(formData.get("areaLabels"), 50),
      cause: allowedValue(
        formData.get("cause"),
        ["operational", "weather", "bank-holiday", "industrial-action", "vehicle", "emergency", "other"] as const,
        "Cause",
      ),
      residentInstruction: requiredText(formData.get("residentInstruction"), "Resident instruction", 400),
      startsAt,
      expectedResumeAt: isoDateTime(formData.get("expectedResumeAt")),
      endsAt: isoDateTime(formData.get("endsAt")),
      sourceUrl: safeHttpsUrl(formData.get("sourceUrl")),
      audience: broadcastAudience(formData, collectionTypes.includes("all") ? [] : collectionTypes),
      status,
      sendPush,
    });
    savedMessage = await broadcastMessage(result.broadcastJobId, "Service disruption saved.");
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, savedMessage));
}

export async function changeDisruptionStatusAction(formData: FormData) {
  const path = "/disruptions";
  let savedMessage = "Disruption status updated.";
  try {
    const status = allowedValue(formData.get("status"), ["published", "resolved", "archived"] as const, "Status");
    const session = await requireCouncilAction("content:publish");
    const sendPush = status === "published" && checked(formData, "sendPush");
    assertAudienceConfirmed(formData, sendPush);
    const jobId = await setDisruptionStatus(
      session,
      assertUuid(requiredText(formData.get("id"), "Disruption", 36)),
      status,
      sendPush,
    );
    savedMessage = await broadcastMessage(jobId, "Disruption status updated.");
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, savedMessage));
}

export async function saveGuidanceAction(formData: FormData) {
  const path = "/guidance";
  try {
    const session = await requireCouncilAction("guidance:write");
    const status = allowedValue(formData.get("status"), ["draft", "published", "archived"] as const, "Status");
    if (status === "published") assertCouncilPermission(session.role, "content:publish");
    await upsertGuidance(session, {
      itemKey: normaliseItemKey(formData.get("itemKey")),
      itemName: requiredText(formData.get("itemName"), "Item name", 120),
      searchTerms: splitValues(formData.get("searchTerms"), 30),
      destination: allowedValue(
        formData.get("destination"),
        ["general", "recycling", "garden", "food", "other", "service", "check"] as const,
        "Destination",
      ),
      heading: requiredText(formData.get("heading"), "Resident answer", 160),
      detail: requiredText(formData.get("detail"), "Guidance details", 400),
      serviceUrl: safeHttpsUrl(formData.get("serviceUrl")),
      status,
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Guidance item saved."));
}

export async function savePartnerAction(formData: FormData) {
  const path = "/partners";
  try {
    const session = await requireCouncilAction("partners:write");
    const status = allowedValue(formData.get("status"), ["draft", "review"] as const, "Status");
    const itemKeys = splitValues(formData.get("itemKeys"), 40)
      .map((itemKey) => normaliseItemKey(itemKey));
    if (!itemKeys.length) {
      throw new Error("Add at least one resident guide item key.");
    }
    await createPartner(session, {
      name: requiredText(formData.get("name"), "Partner name", 160),
      category: allowedValue(
        formData.get("category"),
        ["bulky-waste", "reuse", "electricals", "batteries", "paint", "garden", "bin-cleaning", "replacement-bins", "other"] as const,
        "Category",
      ),
      description: requiredText(formData.get("description"), "Description", 400),
      serviceUrl: safeHttpsUrl(formData.get("serviceUrl"), true)!,
      itemKeys,
      disclosureLabel: requiredText(formData.get("disclosureLabel"), "Disclosure label", 80),
      referralModel: allowedValue(
        formData.get("referralModel"),
        ["none", "flat-fee", "commission", "sponsored-placement"] as const,
        "Referral model",
      ),
      commissionPence: optionalText(formData.get("commissionPence"), 12)
        ? integerValue(formData.get("commissionPence"), "Commission", 0, 100000)
        : undefined,
      bookingMode: allowedValue(
        formData.get("bookingMode"),
        ["none", "external-referral", "stripe-connect"] as const,
        "Booking mode",
      ),
      bookingPricePence: optionalText(formData.get("bookingPricePence"), 12)
        ? integerValue(formData.get("bookingPricePence"), "Fixed price", 100, 1000000)
        : undefined,
      platformFeePence: optionalText(formData.get("platformFeePence"), 12)
        ? integerValue(formData.get("platformFeePence"), "Platform fee", 0, 100000)
        : undefined,
      stripeAccountId: optionalText(formData.get("stripeAccountId"), 255),
      priority: integerValue(formData.get("priority"), "Priority", 1, 1000),
      licenceReference: optionalText(formData.get("licenceReference"), 120),
      supportedAreaLabels: splitValues(formData.get("supportedAreaLabels"), 40, 80),
      complaintContact: optionalText(formData.get("complaintContact"), 160),
      evidenceUrl: safeHttpsUrl(formData.get("evidenceUrl")),
      budgetPence: optionalText(formData.get("budgetPence"), 12)
        ? integerValue(formData.get("budgetPence"), "Campaign budget", 0, 100000000)
        : undefined,
      suspensionReason: undefined,
      renewalReviewAt: isoDate(formData.get("renewalReviewAt")),
      startsAt: isoDateTime(formData.get("startsAt")),
      endsAt: isoDateTime(formData.get("endsAt")),
      status,
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Partner service saved for review."));
}

export async function savePilotBaselineAction(formData: FormData) {
  const path = "/analytics";
  try {
    const session = await requireCouncilAction("analytics:view");
    const optionalInteger = (key: string, label: string, max: number) => (
      optionalText(formData.get(key), 12)
        ? integerValue(formData.get(key), label, 0, max)
        : undefined
    );
    await saveCouncilPilotBaseline(session, {
      periodStartsOn: isoDate(formData.get("periodStartsOn"), true)!,
      periodEndsOn: isoDate(formData.get("periodEndsOn"), true)!,
      agreedContactCostPence: optionalInteger("agreedContactCostPence", "Agreed contact cost", 100000),
      residentContacts: optionalInteger("residentContacts", "Resident contacts", 100000000),
      missedCollectionContacts: optionalInteger("missedCollectionContacts", "Missed-collection contacts", 100000000),
      notes: optionalText(formData.get("notes"), 1000),
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Pilot baseline saved."));
}

export async function createPlatformIncidentAction(formData: FormData) {
  const path = "/status-admin";
  try {
    const session = await requirePlatformAdminAction();
    await createPlatformIncident(session, {
      component: allowedValue(formData.get("component"), ["resident-app", "council-gateway", "push", "accounts", "council-console", "partner-feeds"] as const, "Component"),
      status: allowedValue(formData.get("status"), ["investigating", "identified", "monitoring"] as const, "Status"),
      title: requiredText(formData.get("title"), "Title", 160),
      detail: requiredText(formData.get("detail"), "Detail", 1000),
      councilProviderIds: splitValues(formData.get("councilProviderIds"), 100, 120),
      startsAt: isoDateTime(formData.get("startsAt"), true)!,
    });
    revalidatePath(path);
  } catch (error) { redirect(errorPath(path, error)); }
  redirect(successPath(path, "Incident published to the status source."));
}

export async function updatePlatformIncidentAction(formData: FormData) {
  const path = "/status-admin";
  try {
    const session = await requirePlatformAdminAction();
    await updatePlatformIncidentStatus(
      session,
      assertUuid(requiredText(formData.get("id"), "Incident", 36)),
      allowedValue(formData.get("status"), ["investigating", "identified", "monitoring", "resolved"] as const, "Status"),
    );
    revalidatePath(path);
  } catch (error) { redirect(errorPath(path, error)); }
  redirect(successPath(path, "Incident status updated."));
}

export async function changePartnerStatusAction(formData: FormData) {
  const path = "/partners";
  try {
    const session = await requireCouncilAction("partners:approve");
    await setPartnerStatus(
      session,
      assertUuid(requiredText(formData.get("id"), "Partner", 36)),
      allowedValue(formData.get("status"), ["active", "paused", "ended"] as const, "Status"),
      optionalText(formData.get("suspensionReason"), 500),
    );
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Partner status updated."));
}

export async function confirmExternalBulkyBookingAction(formData: FormData) {
  const path = "/partners";
  try {
    const session = await requireCouncilAction("partners:approve");
    const reference = requiredText(formData.get("reference"), "What Bin reference", 24).toUpperCase();
    if (!/^WB-[A-Z0-9]{12}$/.test(reference)) throw new Error("The What Bin booking reference is invalid.");
    await confirmExternalBulkyBooking(
      session,
      reference,
      requiredText(formData.get("providerReference"), "Provider confirmation reference", 160),
    );
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "The provider-confirmed booking is now included in the evidence ledger."));
}

export async function saveSponsorshipProgrammeAction(formData: FormData) {
  const path = "/sponsorship";
  try {
    const session = await requireCouncilAction("organisation:manage");
    const features = selectedValues(formData, "features");
    const allowedFeatures = ["plus", "household-sharing", "extra-reminders", "collection-history", "calendar-tools"];
    if (!features.length || features.some((feature) => !allowedFeatures.includes(feature))) {
      throw new Error("Choose at least one supported sponsored feature.");
    }
    const startsAt = isoDateTime(formData.get("startsAt"), true)!;
    const endsAt = isoDateTime(formData.get("endsAt"));
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) throw new Error("The sponsorship end must be after its start.");
    await createSponsorshipProgramme(session, {
      sponsorType: allowedValue(formData.get("sponsorType"), ["council", "housing"] as const, "Sponsor type"),
      status: allowedValue(formData.get("status"), ["draft", "active"] as const, "Status"),
      residentLabel: requiredText(formData.get("residentLabel"), "Resident wording", 160),
      features,
      startsAt,
      endsAt,
      renewalAt: isoDate(formData.get("renewalAt")),
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Sponsorship programme saved."));
}

export async function changeSponsorshipProgrammeStatusAction(formData: FormData) {
  const path = "/sponsorship";
  try {
    const session = await requireCouncilAction("organisation:manage");
    await setSponsorshipProgrammeStatus(
      session,
      assertUuid(requiredText(formData.get("id"), "Sponsorship programme", 36)),
      allowedValue(formData.get("status"), ["active", "paused", "ended"] as const, "Status"),
    );
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Sponsorship status updated."));
}

export async function saveCouncilFeaturesAction(formData: FormData) {
  const path = "/setup";
  try {
    const session = await requireCouncilAction("organisation:manage");
    const enabled = new Set(selectedValues(formData, "features"));
    const known = new Set([
      "collectionDates", "councilBranding", "pushAlerts", "missedCollection", "directReporting",
      "recyclingGuide", "partnerServices", "supportInbox", "sponsoredPlus", "analyticsExports", "bulkyWasteBooking",
    ]);
    if ([...enabled].some((feature) => !known.has(feature))) throw new Error("A selected feature is invalid.");
    await saveCouncilFeatureFlags(session, {
      collectionDates: enabled.has("collectionDates"),
      councilBranding: enabled.has("councilBranding"),
      pushAlerts: enabled.has("pushAlerts"),
      missedCollection: enabled.has("missedCollection"),
      directReporting: enabled.has("directReporting"),
      recyclingGuide: enabled.has("recyclingGuide"),
      partnerServices: enabled.has("partnerServices"),
      supportInbox: enabled.has("supportInbox"),
      sponsoredPlus: enabled.has("sponsoredPlus"),
      analyticsExports: enabled.has("analyticsExports"),
      bulkyWasteBooking: enabled.has("bulkyWasteBooking"),
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Council features updated."));
}

export async function saveCouncilOnboardingItemAction(formData: FormData) {
  const path = "/setup";
  try {
    const session = await requireCouncilAction("organisation:manage");
    await saveCouncilOnboardingItem(session, {
      itemKey: requiredText(formData.get("itemKey"), "Setup item", 40),
      status: allowedValue(formData.get("status"), ["not-started", "in-progress", "complete", "blocked"] as const, "Setup status"),
      evidenceNote: optionalText(formData.get("evidenceNote"), 500),
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Council setup updated."));
}

export async function saveReportingRuleAction(formData: FormData) {
  const path = "/reports";
  try {
    const session = await requireCouncilAction("reports:write");
    const mode = allowedValue(formData.get("mode"), ["official-handoff", "disabled"] as const, "Reporting mode");
    const reportUrl = safeHttpsUrl(formData.get("reportUrl"));
    if (mode === "official-handoff" && !reportUrl) {
      throw new Error("An official council reporting link is required.");
    }
    const integrationSecretRef = optionalText(formData.get("integrationSecretRef"), 120);
    if (
      integrationSecretRef
      && !/^BIN_COUNCIL_[A-Z0-9_]{3,100}$/.test(integrationSecretRef)
    ) {
      throw new Error("Server secret references must start with BIN_COUNCIL_ and use capital letters, numbers or underscores.");
    }
    await saveReportingRule(session, {
      enabled: formData.get("enabled") === "on" && mode !== "disabled",
      mode,
      reportUrl,
      eligibilityStartsHours: integerValue(formData.get("eligibilityStartsHours"), "Eligibility delay", 0, 72),
      reportingDeadlineHours: integerValue(formData.get("reportingDeadlineHours"), "Reporting deadline", 1, 720),
      requireDelayCheck: formData.get("requireDelayCheck") === "on",
      residentInstruction: optionalText(formData.get("residentInstruction"), 500),
      integrationSecretRef,
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Missed-collection workflow updated."));
}

export async function saveOrganisationBrandAction(formData: FormData) {
  const path = "/settings";
  try {
    const session = await requireCouncilAction("organisation:manage");
    const primaryColour = requiredText(formData.get("primaryColour"), "Primary colour", 7).toUpperCase();
    const secondaryColour = requiredText(formData.get("secondaryColour"), "Secondary colour", 7).toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(primaryColour) || !/^#[0-9A-F]{6}$/.test(secondaryColour)) {
      throw new Error("Brand colours must be six-digit hex values.");
    }
    await updateOrganisationBrand(session, {
      brandName: optionalText(formData.get("brandName"), 160),
      primaryColour,
      secondaryColour,
      sponsorshipLabel: optionalText(formData.get("sponsorshipLabel"), 120),
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Council branding updated."));
}

export async function saveCrmAccountAction(formData: FormData) {
  const path = "/crm";
  let accountId: string | undefined;
  try {
    const session = await requirePlatformAdminAction();
    const annualValuePounds = optionalText(formData.get("annualValuePounds"), 12)
      ? integerValue(formData.get("annualValuePounds"), "Annual opportunity", 0, 10_000_000)
      : undefined;
    accountId = await createCrmAccount(session, {
      accountType: allowedValue(
        formData.get("accountType"),
        ["council", "sponsor", "partner", "enterprise"] as const,
        "Account type",
      ),
      name: requiredText(formData.get("name"), "Account name", 180),
      websiteUrl: safeHttpsUrl(formData.get("websiteUrl")),
      stage: allowedValue(
        formData.get("stage"),
        ["lead", "contacted", "discovery", "proposal", "pilot", "won", "lost", "paused"] as const,
        "Stage",
      ),
      annualValuePence: annualValuePounds === undefined ? undefined : annualValuePounds * 100,
      summary: optionalText(formData.get("summary"), 2000),
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(`/crm/${accountId}?saved=${encodeURIComponent("CRM account created.")}`);
}

export async function changeCrmAccountStageAction(formData: FormData) {
  const accountId = assertUuid(requiredText(formData.get("accountId"), "Account", 36));
  const path = `/crm/${accountId}`;
  try {
    const session = await requirePlatformAdminAction();
    await updateCrmAccountStage(
      session,
      accountId,
      allowedValue(
        formData.get("stage"),
        ["lead", "contacted", "discovery", "proposal", "pilot", "won", "lost", "paused"] as const,
        "Stage",
      ),
    );
    revalidatePath("/crm");
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Pipeline stage updated."));
}

export async function saveCrmContactAction(formData: FormData) {
  const accountId = assertUuid(requiredText(formData.get("accountId"), "Account", 36));
  const path = `/crm/${accountId}`;
  try {
    const session = await requirePlatformAdminAction();
    await createCrmContact(session, {
      accountId,
      fullName: requiredText(formData.get("fullName"), "Contact name", 160),
      jobTitle: optionalText(formData.get("jobTitle"), 160),
      professionalEmail: safeEmail(formData.get("professionalEmail")),
      professionalPhone: optionalText(formData.get("professionalPhone"), 40),
      linkedinUrl: safeHttpsUrl(formData.get("linkedinUrl")),
      preferredChannel: allowedValue(
        formData.get("preferredChannel"),
        ["email", "phone", "linkedin", "meeting", "none"] as const,
        "Preferred channel",
      ),
      lawfulBasis: allowedValue(
        formData.get("lawfulBasis"),
        ["legitimate-interests", "consent", "contract", "public-task"] as const,
        "Lawful basis",
      ),
      source: requiredText(formData.get("source"), "Contact source", 200),
      doNotContact: formData.get("doNotContact") === "on",
      retentionReviewAt: isoDate(formData.get("retentionReviewAt"), true)!,
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Professional contact saved."));
}

export async function saveCrmActivityAction(formData: FormData) {
  const accountId = assertUuid(requiredText(formData.get("accountId"), "Account", 36));
  const path = `/crm/${accountId}`;
  try {
    const session = await requirePlatformAdminAction();
    const contact = optionalText(formData.get("contactId"), 36);
    await createCrmActivity(session, {
      accountId,
      contactId: contact ? assertUuid(contact) : undefined,
      kind: allowedValue(
        formData.get("kind"),
        ["email", "call", "meeting", "note", "proposal", "demo", "task-update"] as const,
        "Activity type",
      ),
      direction: allowedValue(
        formData.get("direction"),
        ["inbound", "outbound", "internal"] as const,
        "Direction",
      ),
      subject: requiredText(formData.get("subject"), "Subject", 180),
      summary: requiredText(formData.get("summary"), "Conversation summary", 3000),
      occurredAt: isoDateTime(formData.get("occurredAt"), true)!,
      nextStep: optionalText(formData.get("nextStep"), 500),
      nextFollowUpAt: isoDateTime(formData.get("nextFollowUpAt")),
    });
    revalidatePath("/crm");
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Conversation recorded."));
}

export async function saveCrmTaskAction(formData: FormData) {
  const accountId = assertUuid(requiredText(formData.get("accountId"), "Account", 36));
  const path = `/crm/${accountId}`;
  try {
    const session = await requirePlatformAdminAction();
    const contact = optionalText(formData.get("contactId"), 36);
    await createCrmTask(session, {
      accountId,
      contactId: contact ? assertUuid(contact) : undefined,
      title: requiredText(formData.get("title"), "Follow-up", 200),
      dueAt: isoDateTime(formData.get("dueAt")),
      priority: allowedValue(
        formData.get("priority"),
        ["low", "normal", "high", "urgent"] as const,
        "Priority",
      ),
    });
    revalidatePath("/crm");
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Follow-up created."));
}

export async function changeCrmTaskStatusAction(formData: FormData) {
  const accountId = assertUuid(requiredText(formData.get("accountId"), "Account", 36));
  const path = `/crm/${accountId}`;
  try {
    const session = await requirePlatformAdminAction();
    await updateCrmTaskStatus(
      session,
      assertUuid(requiredText(formData.get("taskId"), "Follow-up", 36)),
      allowedValue(
        formData.get("status"),
        ["open", "in-progress", "completed", "cancelled"] as const,
        "Follow-up status",
      ),
    );
    revalidatePath("/crm");
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Follow-up status updated."));
}

export async function saveCrmMessageAction(formData: FormData) {
  const accountId = assertUuid(requiredText(formData.get("accountId"), "Organisation", 36));
  const path = "/crm/messages";
  try {
    const session = await requirePlatformAdminAction();
    const contact = optionalText(formData.get("contactId"), 36);
    const thread = optionalText(formData.get("threadId"), 36);
    const direction = allowedValue(
      formData.get("direction"),
      ["sent", "received", "internal"] as const,
      "Direction",
    );
    const deliveryStatus = allowedValue(
      formData.get("deliveryStatus"),
      ["draft", "sent", "delivered", "received", "read", "failed"] as const,
      "Message status",
    );
    const validStatuses = {
      sent: ["draft", "sent", "delivered", "failed"],
      received: ["received", "read"],
      internal: ["read"],
    } as const;
    if (!(validStatuses[direction] as readonly string[]).includes(deliveryStatus)) {
      throw new Error(`Choose a valid status for a ${direction} message.`);
    }
    const recipientAddresses = splitValues(formData.get("recipientAddresses"), 25, 320);
    if (direction === "sent" && !recipientAddresses.length) {
      throw new Error("Record at least one recipient for a sent message.");
    }
    await createCrmMessage(session, {
      threadId: thread ? assertUuid(thread) : undefined,
      accountId,
      contactId: contact ? assertUuid(contact) : undefined,
      direction,
      channel: allowedValue(
        formData.get("channel"),
        ["email", "phone", "sms", "linkedin", "meeting", "note"] as const,
        "Channel",
      ),
      senderAddress: optionalText(formData.get("senderAddress"), 320),
      recipientAddresses,
      subject: requiredText(formData.get("subject"), "Subject", 300),
      body: requiredText(formData.get("body"), "Message", 20_000),
      occurredAt: isoDateTime(formData.get("occurredAt"), true)!,
      deliveryStatus,
      externalMessageId: optionalText(formData.get("externalMessageId"), 500),
      attachmentNames: splitValues(formData.get("attachmentNames"), 25, 200),
    });
    revalidatePath("/crm");
    revalidatePath(path);
    revalidatePath(`/crm/${accountId}`);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Correspondence saved."));
}

export async function replyToResidentSupportAction(formData: FormData) {
  let path = "/crm/messages";
  try {
    const threadId = assertUuid(requiredText(formData.get("threadId"), "Conversation", 36));
    path = `/crm/messages?thread=${threadId}`;
    const session = await requireCouncilAction("support:reply");
    await replyToResidentSupportThread(
      session,
      threadId,
      requiredText(formData.get("body"), "Reply", 5_000),
    );
    revalidatePath("/crm/messages");
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Reply sent in the app."));
}

export async function changeResidentSupportStatusAction(formData: FormData) {
  let path = "/crm/messages";
  try {
    const threadId = assertUuid(requiredText(formData.get("threadId"), "Conversation", 36));
    path = `/crm/messages?thread=${threadId}`;
    const session = await requireCouncilAction("support:reply");
    const status = allowedValue(
      formData.get("status"),
      ["new", "in-progress", "waiting-resident", "waiting-operations", "resolved", "closed"] as const,
      "Conversation status",
    );
    await setResidentSupportThreadStatus(
      session,
      threadId,
      status,
      optionalText(formData.get("reopenReason"), 500),
    );
    revalidatePath("/crm/messages");
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Conversation updated."));
}

export async function updateResidentSupportCaseAction(formData: FormData) {
  let path = "/crm/messages";
  try {
    const threadId = assertUuid(requiredText(formData.get("threadId"), "Conversation", 36));
    path = `/crm/messages?thread=${threadId}`;
    const session = await requireCouncilAction("support:reply");
    await updateResidentSupportCase(session, threadId, {
      status: allowedValue(
        formData.get("status"),
        ["new", "in-progress", "waiting-resident", "waiting-operations", "resolved", "closed"] as const,
        "Conversation status",
      ),
      priority: allowedValue(formData.get("priority"), ["low", "normal", "high", "urgent"] as const, "Priority"),
      escalationStatus: allowedValue(
        formData.get("escalationStatus"),
        ["none", "operations", "platform", "safeguarding"] as const,
        "Escalation",
      ),
      assignedStaffId: optionalText(formData.get("assignedStaffId"), 36)
        ? assertUuid(optionalText(formData.get("assignedStaffId"), 36)!)
        : undefined,
      slaDueAt: isoDateTime(formData.get("slaDueAt")),
      topicTags: splitValues(formData.get("topicTags"), 20, 40),
      linkedReportTrackingId: optionalText(formData.get("linkedReportTrackingId"), 36)
        ? assertUuid(optionalText(formData.get("linkedReportTrackingId"), 36)!)
        : undefined,
      linkedAnnouncementId: optionalText(formData.get("linkedAnnouncementId"), 36)
        ? assertUuid(optionalText(formData.get("linkedAnnouncementId"), 36)!)
        : undefined,
      reopenReason: optionalText(formData.get("reopenReason"), 500),
    });
    revalidatePath("/crm/messages");
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Case details updated."));
}

export async function addResidentSupportInternalNoteAction(formData: FormData) {
  let path = "/crm/messages";
  try {
    const threadId = assertUuid(requiredText(formData.get("threadId"), "Conversation", 36));
    path = `/crm/messages?thread=${threadId}`;
    const session = await requireCouncilAction("support:reply");
    await addResidentSupportInternalNote(
      session,
      threadId,
      requiredText(formData.get("body"), "Internal note", 5_000),
    );
    revalidatePath("/crm/messages");
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Internal note saved."));
}

export async function createResidentSupportSavedResponseAction(formData: FormData) {
  const path = "/crm/messages";
  try {
    const session = await requireCouncilAction("support:reply");
    await createResidentSupportSavedResponse(session, {
      title: requiredText(formData.get("title"), "Saved response title", 120),
      body: requiredText(formData.get("body"), "Saved response", 5_000),
      topicTags: splitValues(formData.get("topicTags"), 20, 40),
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Saved response added."));
}
