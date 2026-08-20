import { BarChart3, Building2, BellRing, UsersRound } from "lucide-react";

import { switchCouncil } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { OperationalQueue } from "@/components/operational-queue";
import { StatusPill } from "@/components/status-pill";
import { requirePlatformAdminSession } from "@/lib/auth";
import { listPlatformCouncilDemandPage } from "@/lib/platform-demand";
import { operationalQueueStateFromServerPage, type OperationalQueueSearchParams } from "@/lib/operational-queue";
import { humanise } from "@/lib/format";

export default async function CouncilDemandPage({ searchParams }: { searchParams: Promise<OperationalQueueSearchParams> }) {
  await requirePlatformAdminSession();
  const params = await searchParams;
  const serverPage = await listPlatformCouncilDemandPage(params);
  const queue = operationalQueueStateFromServerPage(serverPage);
  const statusValues = serverPage.statusValues;

  return (
    <>
      <PageHeader
        eyebrow="Operations workspace"
        title="Council demand"
        description="Privacy-minimised resident demand by authority. Counts use random installation IDs and never expose a postcode, address, account or device identity."
      />
      <section aria-label="Council demand metrics" className="metric-grid">
        <article className="metric-card tone-blue"><span className="metric-label">Currently linked</span><strong className="metric-value">{serverPage.metrics.totalLinked.toLocaleString("en-GB")}</strong><span className="metric-detail">Current saved-place links across councils</span></article>
        <article className="metric-card tone-teal"><span className="metric-label">All-time residents</span><strong className="metric-value">{serverPage.metrics.totalAllTime.toLocaleString("en-GB")}</strong><span className="metric-detail">Historical unique installation links</span></article>
        <article className="metric-card tone-amber"><span className="metric-label">Connection requests</span><strong className="metric-value">{serverPage.metrics.totalRequests.toLocaleString("en-GB")}</strong><span className="metric-detail">Residents asking to be told when dates connect</span></article>
        <article className="metric-card tone-red"><span className="metric-label">Authorities with demand</span><strong className="metric-value">{serverPage.metrics.authoritiesWithDemand}</strong><span className="metric-detail">Councils with at least one resident installation</span></article>
      </section>

      <OperationalQueue
        action={<BarChart3 aria-hidden="true" color="#007AFF" size={23} />}
        caption="Privacy-minimised resident demand by council, with current links, notification requests, weekly trend, support volume and CRM stage."
        columns={[
          { label: "Council", sortKey: "name" },
          { align: "right", label: "Residents", sortKey: "residents" },
          { align: "right", label: "Requests", sortKey: "requests" },
          { align: "right", label: "Weekly Trend", sortKey: "growth" },
          { align: "right", label: "Support", sortKey: "support" },
          { label: "Stage" },
          { label: "Portal" },
        ]}
        emptyState={<div className="empty-state"><UsersRound aria-hidden="true" size={32} /><h2>No Matching Council Demand</h2><p>Real saved-place links and connection requests will appear here.</p></div>}
        filterLabel="demand states"
        filterOptions={[{ label: "Has resident demand", value: "with-demand" }, { label: "No recorded demand", value: "without-demand" }]}
        pathname="/demand"
        searchLabel="Search council, provider or stage"
        state={queue}
        statusOptions={statusValues.map((value) => ({ label: humanise(value), value }))}
        title="Resident Demand by Council"
        viewKey="council-demand"
      >
        {queue.items.map((council) => (
          <tr key={council.providerId}>
            <td className="queue-primary-cell" data-label="Council"><strong><Building2 aria-hidden="true" size={16} /> {council.councilName}</strong><small translate="no">{council.providerId}</small></td>
            <td className="queue-cell-numeric" data-label="Residents"><strong>{council.currentlyLinked.toLocaleString("en-GB")}</strong><small>{council.activeResidents} active · {council.allTimeResidents} all time</small></td>
            <td className="queue-cell-numeric" data-label="Requests"><strong>{council.notificationRequests.toLocaleString("en-GB")}</strong><small><BellRing aria-hidden="true" size={12} /> notify requests</small></td>
            <td className="queue-cell-numeric" data-label="Weekly Trend"><strong>{council.weeklyGrowthPercent === undefined ? `+${council.weeklyNewResidents}` : `${council.weeklyGrowthPercent >= 0 ? "+" : ""}${council.weeklyGrowthPercent}%`}</strong><small>{council.weeklyNewResidents} new this week</small></td>
            <td className="queue-cell-numeric" data-label="Support">{council.supportCases.toLocaleString("en-GB")}<small>resident cases</small></td>
            <td data-label="Stage"><StatusPill status={council.crmStage ?? council.councilStatus} /></td>
            <td className="queue-cell-actions" data-label="Portal"><form action={switchCouncil}><input name="organisationId" type="hidden" value={council.organisationId} /><input name="returnTo" type="hidden" value="/council" /><button className="secondary-button button-small" type="submit">Open Portal</button></form></td>
          </tr>
        ))}
      </OperationalQueue>
      <div className="truth-note space-top-lg">This page is evidence of app adoption—not a claim about resident population, households reached or service savings. Uninstall cannot be detected; “active” means seen in the last 30 days.</div>
    </>
  );
}
