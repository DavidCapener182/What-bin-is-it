import { councilMemberships } from "@/lib/auth";
import type { CouncilStaffSession } from "@/lib/types";
import { ConsoleShellClient } from "./console-shell-client";

export async function ConsoleShell({
  session,
  children,
}: {
  session: CouncilStaffSession;
  children: React.ReactNode;
}) {
  const memberships = await councilMemberships(session.userId);
  return (
    <ConsoleShellClient
      memberships={memberships.map((membership) => ({
        organisationId: membership.organisation_id,
        organisationName: membership.organisation_name,
      }))}
      session={session}
    >
      {children}
    </ConsoleShellClient>
  );
}
