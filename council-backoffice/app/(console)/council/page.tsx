import Link from "next/link";

import { CouncilOverview } from "@/components/council-overview";
import { requireCouncilSession } from "@/lib/auth";

export default async function SelectedCouncilOverviewPage() {
  const session = await requireCouncilSession("dashboard:view");
  return (
    <>
      {session.platformAdmin ? (
        <div className="platform-context-bar">
          <span>Viewing {session.organisation.name} council portal</span>
          <Link href="/">Return to platform overview</Link>
        </div>
      ) : null}
      <CouncilOverview session={session} />
    </>
  );
}
