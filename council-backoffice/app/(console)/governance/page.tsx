import { Database, FileDown, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { requirePlatformAdminSession } from "@/lib/auth";

export default async function PlatformGovernancePage() {
  const session = await requirePlatformAdminSession();
  return (
    <>
      <PageHeader eyebrow="Governance workspace" title="Platform controls" description="Permissions, privacy boundaries, retention and audit controls across the What Bin platform. Council workspaces remain tenant-scoped." />
      <section className="metric-grid">
        <article className="metric-card tone-blue"><ShieldCheck aria-hidden="true" size={22} /><span className="metric-label">Authenticated administrator</span><strong className="metric-value compact-metric">{session.email ?? "Platform account"}</strong><span className="metric-detail">Explicit superadmin record; no email-domain inference</span></article>
        <article className="metric-card tone-teal"><Database aria-hidden="true" size={22} /><span className="metric-label">Resident boundary</span><strong className="metric-value compact-metric">Local first</strong><span className="metric-detail">No household address or postcode is exposed in council analytics</span></article>
        <article className="metric-card tone-amber"><UsersRound aria-hidden="true" size={22} /><span className="metric-label">Tenant isolation</span><strong className="metric-value compact-metric">Council scoped</strong><span className="metric-detail">Council staff can only access their assigned authority</span></article>
      </section>
      <section className="overview-grid">
        <article className="panel">
          <div className="panel-heading"><h2>Controls</h2></div>
          <div className="connection-list">
            <div className="connection-row"><div><strong>Staff and permissions</strong><br /><span>Owner, admin, editor, analyst and support roles are checked on every server action.</span></div></div>
            <div className="connection-row"><div><strong>Audit</strong><br /><span>Publishing, status, case, feature and commercial changes create append-only council audit entries.</span></div></div>
            <div className="connection-row"><div><strong>Retention</strong><br /><span>Support and CRM records carry explicit lifecycle states; platform evidence contains pseudonymous identifiers only.</span></div></div>
            <div className="connection-row"><div><strong>Data exports</strong><br /><span>Council evidence exports are aggregated and low-volume groups are suppressed.</span></div></div>
          </div>
        </article>
        <aside className="panel">
          <FileDown aria-hidden="true" color="#007AFF" size={27} />
          <h2 className="space-top-md">Operational access</h2>
          <p className="form-intro">Enter an individual council portal from Platform overview to inspect its staff, audit, privacy, export and retention controls. This platform view never silently assumes a council context.</p>
          <Link className="primary-button" href="/">Choose a council workspace</Link>
        </aside>
      </section>
    </>
  );
}
