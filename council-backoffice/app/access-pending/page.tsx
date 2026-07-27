import type { Metadata } from "next";
import { Building2, ShieldX } from "lucide-react";

import { signOutCouncil } from "@/app/actions";
import { authenticatedCouncilIdentity, getCouncilSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Council access pending" };
export const dynamic = "force-dynamic";

export default async function AccessPendingPage() {
  const identity = await authenticatedCouncilIdentity();
  if (!identity) redirect("/login");
  if (await getCouncilSession()) redirect("/");
  return (
    <main className="pending-page">
      <div className="pending-card">
        <span className="pending-icon"><ShieldX aria-hidden="true" size={30} /></span>
        <span className="eyebrow">Access not assigned</span>
        <h1>Your account is signed in, but it is not attached to an active council.</h1>
        <p>
          Ask your What Bin platform administrator to assign <strong>{identity.email ?? "this account"}</strong> to
          a council organisation and staff role.
        </p>
        <div className="pending-guidance">
          <Building2 aria-hidden="true" size={19} />
          <span>No council or resident information has been shown.</span>
        </div>
        <form action={signOutCouncil}>
          <button className="secondary-button" type="submit">Sign out</button>
        </form>
      </div>
    </main>
  );
}
