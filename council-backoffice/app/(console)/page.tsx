import Link from "next/link";
import { Building2 } from "lucide-react";

import { switchCouncil } from "@/app/actions";
import { CouncilOverview } from "@/components/council-overview";
import { OperationalQueue } from "@/components/operational-queue";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { platformOverviewPage } from "@/lib/crm";
import { humanise } from "@/lib/format";
import { operationalQueueStateFromServerPage, type OperationalQueueSearchParams } from "@/lib/operational-queue";

function gbp(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

async function PlatformOverview({ searchParams }: { searchParams: Promise<OperationalQueueSearchParams> }) {
  const params = await searchParams;
  const overview = await platformOverviewPage(params);
  const queue = operationalQueueStateFromServerPage(overview.councils);
  const statusValues = overview.statuses;
  const planValues = overview.plans;
  return (
    <>
      <PageHeader
        eyebrow="Platform control"
        title="What Bin platform overview"
        description="Your overall view across every council portal, commercial relationship and resident-service connection. Enter an individual authority only when you need its operational workspace."
        action={<Link className="primary-button" href="/crm">Open platform CRM</Link>}
      />

      <section aria-label="Platform metrics" className="metric-grid">
        <article className="metric-card tone-blue">
          <span className="metric-label">Council workspaces</span>
          <strong className="metric-value">{overview.councils.unfilteredTotal}</strong>
          <span className="metric-detail">{overview.activeCouncilCount} active or in pilot</span>
        </article>
        <article className="metric-card tone-teal">
          <span className="metric-label">CRM relationships</span>
          <strong className="metric-value">{overview.crm.accountCount}</strong>
          <span className="metric-detail">{overview.crm.activeOpportunities} active opportunities</span>
        </article>
        <article className="metric-card tone-amber">
          <span className="metric-label">Pipeline value</span>
          <strong className="metric-value">{gbp(overview.crm.pipelineValuePence)}</strong>
          <span className="metric-detail">Annual opportunity excluding lost and paused accounts</span>
        </article>
        <article className="metric-card tone-red">
          <span className="metric-label">Follow-ups due</span>
          <strong className="metric-value">{overview.crm.followUpsDue}</strong>
          <span className="metric-detail">Commercial relationships needing attention now</span>
        </article>
      </section>

      <OperationalQueue
        caption="Council workspaces across the platform, with tenant status, plan, staff and active resident content."
        columns={[
          { label: "Council", sortKey: "name" },
          { label: "Provider ID" },
          { label: "Plan" },
          { align: "right", label: "Staff", sortKey: "staff" },
          { label: "Live Content", sortKey: "content" },
          { label: "Status", sortKey: "status" },
          { label: "Portal" },
        ]}
        emptyState={<div className="empty-state"><Building2 aria-hidden="true" size={32} /><h2>No Matching Council Workspaces</h2><p>Provision a verified council tenant, or reset this view.</p></div>}
        filterLabel="plans"
        filterOptions={planValues.map((value) => ({ label: humanise(value), value }))}
        pathname="/"
        searchLabel="Search council, provider or plan"
        state={queue}
        statusOptions={statusValues.map((value) => ({ label: humanise(value), value }))}
        title="Council Estate"
        viewKey="platform-councils"
      >
        {queue.items.map((council) => (
          <tr key={council.id}>
            <td className="queue-primary-cell" data-label="Council"><strong>{council.name}</strong></td>
            <td data-label="Provider ID"><span translate="no">{council.providerId}</span></td>
            <td data-label="Plan">{humanise(council.planTier)}</td>
            <td className="queue-cell-numeric" data-label="Staff">{council.staffCount.toLocaleString("en-GB")}</td>
            <td data-label="Live Content"><strong>{council.liveAnnouncementCount} notices</strong><small>{council.activeDisruptionCount} disruptions</small></td>
            <td data-label="Status"><StatusPill status={council.status} /></td>
            <td className="queue-cell-actions" data-label="Portal"><form action={switchCouncil}><input name="organisationId" type="hidden" value={council.id} /><input name="returnTo" type="hidden" value="/council" /><button className="secondary-button button-small" type="submit">Open Portal</button></form></td>
          </tr>
        ))}
      </OperationalQueue>

      <div className="truth-note space-top-lg">
        Platform CRM contacts and council operational workspaces are deliberately separated. Business conversations never enter resident analytics or collection records.
      </div>
    </>
  );
}

export default async function ConsoleOverviewPage({
  searchParams,
}: {
  searchParams: Promise<OperationalQueueSearchParams>;
}) {
  const session = await requireCouncilSession("dashboard:view");
  return session.platformAdmin
    ? <PlatformOverview searchParams={searchParams} />
    : <CouncilOverview session={session} />;
}
