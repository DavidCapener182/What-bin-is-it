import Link from "next/link";
import { Building2 } from "lucide-react";

import { switchCouncil } from "@/app/actions";
import { CouncilOverview } from "@/components/council-overview";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { platformOverview } from "@/lib/crm";
import { humanise } from "@/lib/format";

function gbp(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

async function PlatformOverview() {
  const overview = await platformOverview();
  const activeCouncils = overview.councils.filter((council) => (
    council.status === "active" || council.status === "pilot"
  )).length;
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
          <strong className="metric-value">{overview.councils.length}</strong>
          <span className="metric-detail">{activeCouncils} active or in pilot</span>
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

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Council estate</span>
            <h2 className="space-top-sm">All council portals</h2>
          </div>
          <Building2 aria-hidden="true" color="#007AFF" size={23} />
        </div>
        {overview.councils.length ? (
          <div className="platform-council-grid">
            {overview.councils.map((council) => (
              <article className="platform-council-card" key={council.id}>
                <div className="data-card-top">
                  <div>
                    <h3>{council.name}</h3>
                    <div className="data-meta">
                      <span>{council.providerId}</span>
                      <span>{humanise(council.planTier)}</span>
                    </div>
                  </div>
                  <StatusPill status={council.status} />
                </div>
                <div className="platform-council-stats">
                  <span><strong>{council.staffCount}</strong> staff</span>
                  <span><strong>{council.liveAnnouncementCount}</strong> live notices</span>
                  <span><strong>{council.activeDisruptionCount}</strong> disruptions</span>
                </div>
                <form action={switchCouncil}>
                  <input name="organisationId" type="hidden" value={council.id} />
                  <input name="returnTo" type="hidden" value="/council" />
                  <button className="secondary-button" type="submit">
                    Enter council portal
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Building2 aria-hidden="true" size={32} />
            <h2>No council workspaces yet</h2>
            <p>Provision a verified council tenant before staff or resident operations are enabled.</p>
          </div>
        )}
      </section>

      <div className="truth-note space-top-lg">
        Platform CRM contacts and council operational workspaces are deliberately separated. Business conversations never enter resident analytics or collection records.
      </div>
    </>
  );
}

export default async function ConsoleOverviewPage() {
  const session = await requireCouncilSession("dashboard:view");
  return session.platformAdmin
    ? <PlatformOverview />
    : <CouncilOverview session={session} />;
}
