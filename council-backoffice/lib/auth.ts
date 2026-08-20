import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { consoleE2eFixtureSession } from "./console-e2e-fixtures";
import { councilDatabase } from "./database";
import { assertCouncilPermission } from "./permissions";
import { createCouncilSupabaseServerClient } from "./supabase/server";
import type {
  CouncilOrganisation,
  CouncilPermission,
  CouncilRole,
  CouncilStaffSession,
} from "./types";

type StaffRow = {
  staff_id: string;
  role: CouncilRole;
  platform_admin: boolean;
  organisation_id: string;
  provider_id: string;
  slug: string;
  organisation_name: string;
  organisation_status: CouncilOrganisation["status"];
  plan_tier: CouncilOrganisation["planTier"];
  brand_name: string | null;
  logo_url: string | null;
  primary_colour: string;
  secondary_colour: string;
  sponsorship_label: string | null;
};

const developmentSuperadminCookie = "what-bin-council-dev-superadmin";

function developmentSuperadminConfiguration() {
  if (process.env.NODE_ENV === "production") return undefined;
  const email = process.env.COUNCIL_BACKOFFICE_DEV_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const secret = process.env.COUNCIL_BACKOFFICE_DEV_SESSION_SECRET?.trim();
  if (!email || !secret || secret.length < 32) return undefined;
  return { email, secret };
}

async function isLocalDevelopmentRequest() {
  if (process.env.NODE_ENV === "production") return false;
  const requestHeaders = await headers();
  const host = (
    requestHeaders.get("x-forwarded-host")
    ?? requestHeaders.get("host")
    ?? ""
  ).split(",")[0].trim().toLowerCase();
  return /^localhost(?::\d+)?$/.test(host) || /^127\.0\.0\.1(?::\d+)?$/.test(host);
}

function signDevelopmentIdentity(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

async function developmentSuperadminIdentity() {
  const configuration = developmentSuperadminConfiguration();
  if (!configuration || !await isLocalDevelopmentRequest()) return undefined;
  const cookieStore = await cookies();
  const token = cookieStore.get(developmentSuperadminCookie)?.value;
  if (!token) return undefined;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return undefined;
  const encoded = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  const expectedSignature = signDevelopmentIdentity(encoded, configuration.secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      email?: unknown;
      userId?: unknown;
      issuedAt?: unknown;
    };
    if (
      payload.email !== configuration.email
      || typeof payload.userId !== "string"
      || typeof payload.issuedAt !== "number"
      || Date.now() - payload.issuedAt > 12 * 60 * 60 * 1_000
    ) {
      return undefined;
    }
    return { userId: payload.userId, email: configuration.email };
  } catch {
    return undefined;
  }
}

export async function developmentSuperadminLoginAvailable() {
  return Boolean(developmentSuperadminConfiguration() && await isLocalDevelopmentRequest());
}

export async function startDevelopmentSuperadminSession(email: string) {
  const configuration = developmentSuperadminConfiguration();
  if (
    !configuration
    || !await isLocalDevelopmentRequest()
    || email.trim().toLowerCase() !== configuration.email
  ) {
    return false;
  }
  const sql = councilDatabase();
  const rows = await sql<{ user_id: string }[]>`
    SELECT platform_admin.user_id
    FROM bin_council_platform_admins AS platform_admin
    INNER JOIN auth.users AS user_account
      ON user_account.id = platform_admin.user_id
    WHERE lower(user_account.email) = ${configuration.email}
      AND platform_admin.status = 'active'
    LIMIT 1
  `;
  if (!rows[0]) return false;
  const encoded = Buffer.from(JSON.stringify({
    email: configuration.email,
    userId: rows[0].user_id,
    issuedAt: Date.now(),
  })).toString("base64url");
  const signature = signDevelopmentIdentity(encoded, configuration.secret);
  const cookieStore = await cookies();
  cookieStore.set(developmentSuperadminCookie, `${encoded}.${signature}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return true;
}

export async function clearDevelopmentSuperadminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(developmentSuperadminCookie);
}

function organisationFromRow(row: StaffRow): CouncilOrganisation {
  return {
    id: row.organisation_id,
    providerId: row.provider_id,
    slug: row.slug,
    name: row.organisation_name,
    status: row.organisation_status,
    planTier: row.plan_tier,
    brandName: row.brand_name ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    primaryColour: row.primary_colour,
    secondaryColour: row.secondary_colour,
    sponsorshipLabel: row.sponsorship_label ?? undefined,
  };
}

export async function authenticatedCouncilIdentity() {
  const fixtureSession = await consoleE2eFixtureSession();
  if (fixtureSession) {
    return { userId: fixtureSession.userId, email: fixtureSession.email };
  }
  const developmentIdentity = await developmentSuperadminIdentity();
  if (developmentIdentity) return developmentIdentity;
  try {
    const supabase = await createCouncilSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims || typeof claims.sub !== "string") return undefined;
    return {
      userId: claims.sub,
      email: typeof claims.email === "string" ? claims.email : undefined,
    };
  } catch {
    return undefined;
  }
}

export async function councilMemberships(userId: string) {
  const fixtureSession = await consoleE2eFixtureSession();
  if (fixtureSession?.userId === userId) {
    return [{
      staff_id: fixtureSession.staffId,
      role: fixtureSession.role,
      platform_admin: fixtureSession.platformAdmin,
      organisation_id: fixtureSession.organisation.id,
      provider_id: fixtureSession.organisation.providerId,
      slug: fixtureSession.organisation.slug,
      organisation_name: fixtureSession.organisation.name,
      organisation_status: fixtureSession.organisation.status,
      plan_tier: fixtureSession.organisation.planTier,
      brand_name: fixtureSession.organisation.brandName ?? null,
      logo_url: fixtureSession.organisation.logoUrl ?? null,
      primary_colour: fixtureSession.organisation.primaryColour,
      secondary_colour: fixtureSession.organisation.secondaryColour,
      sponsorship_label: fixtureSession.organisation.sponsorshipLabel ?? null,
    }] satisfies StaffRow[];
  }
  const sql = councilDatabase();
  const platformRows = await sql<{ id: string }[]>`
    SELECT id
    FROM bin_council_platform_admins
    WHERE user_id = ${userId}::uuid
      AND status = 'active'
    LIMIT 1
  `;
  if (platformRows[0]) {
    return sql<StaffRow[]>`
      SELECT
        ${platformRows[0].id}::uuid AS staff_id,
        'owner'::varchar AS role,
        true AS platform_admin,
        organisation.id AS organisation_id,
        organisation.provider_id,
        organisation.slug,
        organisation.name AS organisation_name,
        organisation.status AS organisation_status,
        organisation.plan_tier,
        organisation.brand_name,
        organisation.logo_url,
        organisation.primary_colour,
        organisation.secondary_colour,
        organisation.sponsorship_label
      FROM bin_council_organisations AS organisation
      WHERE organisation.status IN ('prospect', 'pilot', 'active')
      ORDER BY organisation.name
      LIMIT 500
    `;
  }
  const rows = await sql<StaffRow[]>`
    SELECT
      staff.id AS staff_id,
      staff.role,
      false AS platform_admin,
      organisation.id AS organisation_id,
      organisation.provider_id,
      organisation.slug,
      organisation.name AS organisation_name,
      organisation.status AS organisation_status,
      organisation.plan_tier,
      organisation.brand_name,
      organisation.logo_url,
      organisation.primary_colour,
      organisation.secondary_colour,
      organisation.sponsorship_label
    FROM bin_council_staff AS staff
    INNER JOIN bin_council_organisations AS organisation
      ON organisation.id = staff.organisation_id
    WHERE staff.user_id = ${userId}::uuid
      AND staff.status = 'active'
      AND organisation.status IN ('pilot', 'active')
    ORDER BY organisation.name, staff.created_at
    LIMIT 50
  `;
  return rows;
}

export async function getCouncilSession(): Promise<CouncilStaffSession | undefined> {
  const identity = await authenticatedCouncilIdentity();
  if (!identity) return undefined;
  const memberships = await councilMemberships(identity.userId);
  if (!memberships.length) return undefined;
  const cookieStore = await cookies();
  const selectedId = cookieStore.get("what-bin-council-org")?.value;
  const selected = memberships.find((row) => row.organisation_id === selectedId) ?? memberships[0];
  return {
    userId: identity.userId,
    email: identity.email,
    staffId: selected.staff_id,
    role: selected.role,
    platformAdmin: selected.platform_admin,
    organisation: organisationFromRow(selected),
  };
}

export async function requireCouncilSession(permission?: CouncilPermission) {
  const identity = await authenticatedCouncilIdentity();
  if (!identity) redirect("/login");
  const session = await getCouncilSession();
  if (!session) redirect("/access-pending");
  if (permission) assertCouncilPermission(session.role, permission);
  return session;
}

export async function requireCouncilAction(permission: CouncilPermission) {
  const identity = await authenticatedCouncilIdentity();
  if (!identity) throw new Error("Your council sign-in has expired.");
  const session = await getCouncilSession();
  if (!session) throw new Error("This account has not been assigned to an active council.");
  assertCouncilPermission(session.role, permission);
  return session;
}

export async function requirePlatformAdminSession() {
  const session = await requireCouncilSession("dashboard:view");
  if (!session.platformAdmin) redirect("/");
  return session;
}

export async function requirePlatformAdminAction() {
  const identity = await authenticatedCouncilIdentity();
  if (!identity) throw new Error("Your platform sign-in has expired.");
  const session = await getCouncilSession();
  if (!session?.platformAdmin) {
    throw new Error("Platform superadmin access is required.");
  }
  return session;
}
