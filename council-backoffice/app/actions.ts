"use server";

import { createHash } from "node:crypto";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { councilMemberships, authenticatedCouncilIdentity, requireCouncilAction } from "@/lib/auth";
import { councilDatabase } from "@/lib/database";
import {
  createAnnouncement,
  createDisruption,
  createPartner,
  saveReportingRule,
  setAnnouncementStatus,
  setDisruptionStatus,
  setPartnerStatus,
  updateOrganisationBrand,
  upsertGuidance,
} from "@/lib/data";
import { assertCouncilPermission } from "@/lib/permissions";
import { createCouncilSupabaseServerClient } from "@/lib/supabase/server";
import {
  assertUuid,
  integerValue,
  isoDateTime,
  normaliseItemKey,
  optionalText,
  requiredText,
  safeHttpsUrl,
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

async function allowSignInAttempt(email: string) {
  const sql = councilDatabase();
  const emailHash = createHash("sha256").update(email).digest("hex");
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
    if (current?.last_requested_at && now - current.last_requested_at.getTime() < 60_000) {
      return false;
    }
    const windowIsCurrent = Boolean(
      current && now - current.window_started_at.getTime() < 60 * 60 * 1_000,
    );
    const nextCount = windowIsCurrent ? current.request_count + 1 : 1;
    if (nextCount > 5) return false;
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
  try {
    const permitted = await allowSignInAttempt(email);
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

export async function signOutCouncil() {
  const supabase = await createCouncilSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
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
  redirect("/");
}

export async function saveAnnouncementAction(formData: FormData) {
  const path = "/announcements";
  try {
    const status = allowedValue(formData.get("status"), ["draft", "published"] as const, "Status");
    const session = await requireCouncilAction("content:write");
    if (status === "published") assertCouncilPermission(session.role, "content:publish");
    const placements = selectedValues(formData, "placements");
    const supportedPlacements = placements.filter((placement) => (
      placement === "home" || placement === "schedule" || placement === "guide"
    ));
    if (!supportedPlacements.length || supportedPlacements.length !== placements.length) {
      throw new Error("Choose at least one currently supported resident surface.");
    }
    await createAnnouncement(session, {
      kind: allowedValue(formData.get("kind"), ["service", "education", "emergency", "seasonal"] as const, "Message type"),
      severity: allowedValue(formData.get("severity"), ["information", "advice", "warning", "critical"] as const, "Severity"),
      title: requiredText(formData.get("title"), "Title", 120),
      body: requiredText(formData.get("body"), "Message", 600),
      placements: supportedPlacements,
      startsAt: isoDateTime(formData.get("startsAt")),
      endsAt: isoDateTime(formData.get("endsAt")),
      sourceUrl: safeHttpsUrl(formData.get("sourceUrl")),
      status,
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Announcement saved."));
}

export async function changeAnnouncementStatusAction(formData: FormData) {
  const path = "/announcements";
  try {
    const status = allowedValue(formData.get("status"), ["published", "archived"] as const, "Status");
    const session = await requireCouncilAction("content:publish");
    await setAnnouncementStatus(
      session,
      assertUuid(requiredText(formData.get("id"), "Announcement", 36)),
      status,
    );
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Announcement status updated."));
}

export async function saveDisruptionAction(formData: FormData) {
  const path = "/disruptions";
  try {
    const status = allowedValue(formData.get("status"), ["draft", "published"] as const, "Status");
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
    await createDisruption(session, {
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
      startsAt: isoDateTime(formData.get("startsAt"), true)!,
      expectedResumeAt: isoDateTime(formData.get("expectedResumeAt")),
      endsAt: isoDateTime(formData.get("endsAt")),
      sourceUrl: safeHttpsUrl(formData.get("sourceUrl")),
      status,
    });
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Service disruption saved."));
}

export async function changeDisruptionStatusAction(formData: FormData) {
  const path = "/disruptions";
  try {
    const status = allowedValue(formData.get("status"), ["published", "resolved", "archived"] as const, "Status");
    const session = await requireCouncilAction("content:publish");
    await setDisruptionStatus(
      session,
      assertUuid(requiredText(formData.get("id"), "Disruption", 36)),
      status,
    );
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Disruption status updated."));
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
      priority: integerValue(formData.get("priority"), "Priority", 1, 1000),
      licenceReference: optionalText(formData.get("licenceReference"), 120),
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

export async function changePartnerStatusAction(formData: FormData) {
  const path = "/partners";
  try {
    const session = await requireCouncilAction("partners:approve");
    await setPartnerStatus(
      session,
      assertUuid(requiredText(formData.get("id"), "Partner", 36)),
      allowedValue(formData.get("status"), ["active", "paused", "ended"] as const, "Status"),
    );
    revalidatePath(path);
  } catch (error) {
    redirect(errorPath(path, error));
  }
  redirect(successPath(path, "Partner status updated."));
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
