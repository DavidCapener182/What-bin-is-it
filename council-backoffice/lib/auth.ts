import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
  const supabase = await createCouncilSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string") return undefined;
  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
  };
}

export async function councilMemberships(userId: string) {
  const sql = councilDatabase();
  const rows = await sql<StaffRow[]>`
    SELECT
      staff.id AS staff_id,
      staff.role,
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
