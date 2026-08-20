import type { CouncilStaffSession } from "./types";

export const consoleE2eFixtureEmail = "operator@council-e2e.test";
export const consoleE2eFixtureSessionCookie = "what-bin-council-e2e-session";
export const consoleE2eFixtureStateCookie = "what-bin-council-e2e-state";
export const consoleE2eFixtureSessionToken = "authorised-local-fixture";

export const consoleE2eFixtureIds = {
  announcement: "10000000-0000-4000-8000-000000000001",
  booking: "WB-E2EBOOKING01",
  disruption: "20000000-0000-4000-8000-000000000002",
  organisation: "30000000-0000-4000-8000-000000000003",
  partner: "40000000-0000-4000-8000-000000000004",
  staff: "50000000-0000-4000-8000-000000000005",
  supportMessage: "60000000-0000-4000-8000-000000000006",
  supportReply: "70000000-0000-4000-8000-000000000007",
  supportThread: "80000000-0000-4000-8000-000000000008",
  user: "90000000-0000-4000-8000-000000000009",
} as const;

export function consoleTestFixturesEnabled(environment: {
  COUNCIL_E2E_FIXTURES?: string;
  NODE_ENV?: string;
} = process.env) {
  return environment.NODE_ENV !== "production" && environment.COUNCIL_E2E_FIXTURES === "1";
}

export function consoleTestFixtureRequestEnabled(
  environment: { COUNCIL_E2E_FIXTURES?: string; NODE_ENV?: string } = process.env,
  host = "",
) {
  const hostname = host.split(",")[0]?.trim().toLowerCase() ?? "";
  return consoleTestFixturesEnabled(environment)
    && (/^localhost(?::\d+)?$/.test(hostname) || /^127\.0\.0\.1(?::\d+)?$/.test(hostname));
}

export function consoleE2eFixtureSessionFor(
  token: string | undefined,
  environment: { COUNCIL_E2E_FIXTURES?: string; NODE_ENV?: string } = process.env,
  host = "",
): CouncilStaffSession | undefined {
  if (
    token !== consoleE2eFixtureSessionToken
    || !consoleTestFixtureRequestEnabled(environment, host)
  ) {
    return undefined;
  }
  return {
    userId: consoleE2eFixtureIds.user,
    email: consoleE2eFixtureEmail,
    staffId: consoleE2eFixtureIds.staff,
    role: "owner",
    platformAdmin: false,
    organisation: {
      id: consoleE2eFixtureIds.organisation,
      providerId: "council-e2e-provider",
      slug: "generated-e2e-council",
      name: "Generated E2E Council",
      status: "active",
      planTier: "enterprise",
      brandName: "Generated E2E Council",
      primaryColour: "#0062cc",
      secondaryColour: "#248a3d",
    },
  };
}

export function isConsoleE2eFixtureSession(session: CouncilStaffSession) {
  return consoleTestFixturesEnabled()
    && session.userId === consoleE2eFixtureIds.user
    && session.staffId === consoleE2eFixtureIds.staff
    && session.organisation.id === consoleE2eFixtureIds.organisation;
}
