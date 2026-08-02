import { BarChart3, Building2, BellRing, UsersRound } from "lucide-react";

import { switchCouncil } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requirePlatformAdminSession } from "@/lib/auth";
import { listPlatformCouncilDemand } from "@/lib/platform-demand";

export default async function CouncilDemandPage() {
  await requirePlatformAdminSession();
  const councils = await listPlatformCouncilDemand();
  const totalLinked = councils.reduce((total, council) => total + council.currentlyLinked, 0);
  const totalAllTime = councils.reduce((total, council) => total + council.allTimeResidents, 0);
  const totalRequests = councils.reduce((total, council) => total + council.notificationRequests, 0);
  const councilsWithResidents = councils.filter((council) => council.allTimeResidents > 0).length;

  return (
    <>
      <PageHeader
        eyebrow="Operations workspace"
        title="Council demand"
        description="Privacy-minimised resident demand by authority. Counts use random installation IDs and never expose a postcode, address, account or device identity."
      />
      <section aria-label="Council demand metrics" className="metric-grid">
        <article className="metric-card tone-blue"><span className="metric-label">Currently linked</span><strong className="metric-value">{totalLinked.toLocaleString("en-GB")}</strong><span className="metric-detail">Current saved-place links across councils</span></article>
        <article className="metric-card tone-teal"><span className="metric-label">All-time residents</span><strong className="metric-value">{totalAllTime.toLocaleString("en-GB")}</strong><span className="metric-detail">Historical unique installation links</span></article>
        <article className="metric-card tone-amber"><span className="metric-label">Connection requests</span><strong className="metric-value">{totalRequests.toLocaleString("en-GB")}</strong><span className="metric-detail">Residents asking to be told when dates connect</span></article>
        <article className="metric-card tone-red"><span className="metric-label">Authorities with demand</span><strong className="metric-value">{councilsWithResidents}</strong><span className="metric-detail">Councils with at least one resident installation</span></article>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Outreach evidence</span><h2 className="space-top-sm">Resident demand by council</h2></div><BarChart3 aria-hidden="true" color="#007AFF" size={23} /></div>
        <div className="demand-table" role="table" aria-label="Council resident demand">
          <div className="demand-table-row demand-table-head" role="row">
            <span role="columnheader">Council</span><span role="columnheader">Residents</span><span role="columnheader">Requests</span><span role="columnheader">Growth</span><span role="columnheader">Support</span><span role="columnheader">Stage</span><span role="columnheader">Portal</span>
          </div>
          {councils.map((council) => (
            <div className="demand-table-row" key={council.providerId} role="row">
              <span className="demand-council" role="cell"><Building2 aria-hidden="true" size={17} /><span><strong>{council.councilName}</strong><small>{council.providerId}</small></span></span>
              <span role="cell"><strong>{council.currentlyLinked.toLocaleString("en-GB")}</strong><small>{council.activeResidents} active · {council.allTimeResidents} all time</small></span>
              <span role="cell"><strong>{council.notificationRequests.toLocaleString("en-GB")}</strong><small><BellRing aria-hidden="true" size={12} /> notify requests</small></span>
              <span role="cell"><strong>{council.weeklyGrowthPercent === undefined ? `+${council.weeklyNewResidents}` : `${council.weeklyGrowthPercent >= 0 ? "+" : ""}${council.weeklyGrowthPercent}%`}</strong><small>{council.weeklyNewResidents} new this week</small></span>
              <span role="cell"><strong>{council.supportCases}</strong><small>resident cases</small></span>
              <span role="cell"><StatusPill status={council.crmStage ?? council.councilStatus} /></span>
              <span role="cell"><form action={switchCouncil}><input name="organisationId" type="hidden" value={council.organisationId} /><input name="returnTo" type="hidden" value="/council" /><button className="secondary-button button-small" type="submit">Open</button></form></span>
            </div>
          ))}
          {!councils.length ? <div className="empty-state"><UsersRound aria-hidden="true" size={32} /><h2>No council demand yet</h2><p>Real saved-place links and connection requests will appear here.</p></div> : null}
        </div>
      </section>
      <div className="truth-note space-top-lg">This page is evidence of app adoption—not a claim about resident population, households reached or service savings. Uninstall cannot be detected; “active” means seen in the last 30 days.</div>
    </>
  );
}
