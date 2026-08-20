import { Database, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";

import { OperationalReadiness } from "@/components/operational-readiness";
import { PageHeader } from "@/components/page-header";
import { requirePlatformAdminSession } from "@/lib/auth";

export default async function PlatformGovernancePage() {
  const session = await requirePlatformAdminSession();
  return (
    <>
      <PageHeader eyebrow="Governance workspace" title="Platform Controls" description="Review implemented controls and explicit prerequisites across permissions, privacy, retention and audit. Council workspaces remain tenant-scoped." />
      <section className="metric-grid">
        <article className="metric-card tone-blue"><ShieldCheck aria-hidden="true" size={22} /><span className="metric-label">Authenticated administrator</span><strong className="metric-value compact-metric">{session.email ?? "Platform account"}</strong><span className="metric-detail">Explicit superadmin record; no email-domain inference</span></article>
        <article className="metric-card tone-teal"><Database aria-hidden="true" size={22} /><span className="metric-label">Resident boundary</span><strong className="metric-value compact-metric">Local first</strong><span className="metric-detail">No household address or postcode in council analytics</span></article>
        <article className="metric-card tone-amber"><UsersRound aria-hidden="true" size={22} /><span className="metric-label">Tenant isolation</span><strong className="metric-value compact-metric">Council scoped</strong><span className="metric-detail">Council access is resolved server-side from an active assignment</span></article>
      </section>
      <OperationalReadiness
        caption="Platform governance controls confirmed in the current console, plus the exact product contracts still required before those controls can be operated here."
        rows={[
          { area: "Role enforcement", currentState: "Owner, admin, editor, analyst and support permissions are checked by server routes and actions", status: "available", nextStep: "Keep permission tests aligned whenever a new action or route is introduced." },
          { area: "Tenant isolation", currentState: "Council data queries and writes use the authenticated organisation scope", status: "available", nextStep: "Maintain cross-tenant negative tests for every new operational query." },
          { area: "Change audit", currentState: "Council and CRM writes append scoped audit events", status: "partial", nextStep: "Add first-class request correlation, actor lifecycle handling and complete paginated evidence export." },
          { area: "Staff administration", currentState: "Assignments exist, but invitation, role-change, suspension and selected-session revocation workflows are absent", status: "unavailable", nextStep: "Implement tenant-scoped staff lifecycle APIs with audited approvals and expiry." },
          { area: "Retention operations", currentState: "No record-class schedule, legal-hold state or deletion-job evidence is represented", status: "unavailable", nextStep: "Define retention policies, executable jobs, exception approval and evidence tables." },
          { area: "Privacy evidence exports", currentState: "Aggregated council evidence CSV is available and low-volume groups are suppressed", status: "partial", nextStep: "Add an export manifest, metric-definition version and signed completion evidence." },
          { area: "Four-eyes publishing", currentState: "Publishing requires explicit role, council and audience confirmation but no separate approver", status: "prerequisite-required", nextStep: "Add versioned draft, approval assignment and immutable approval-decision records." },
          { area: "Provider assurance", currentState: "Partner evidence fields and booking settlement state exist; insurance, dispute and payout-reconciliation contracts do not", status: "partial", nextStep: "Add the provider assurance and commercial reconciliation contracts before claiming full governance coverage." },
        ]}
        title="Governance Control Register"
      />
      <section className="panel space-top-lg">
        <h2>Enter an Operational Workspace</h2>
        <p className="form-intro">Choose a council from Platform overview before inspecting its tenant-scoped audit, setup, privacy or content controls. This view never silently assumes a council context.</p>
        <Link className="primary-button" href="/">Choose a Council Workspace</Link>
      </section>
    </>
  );
}
