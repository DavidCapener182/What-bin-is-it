import { Download, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { dashboardMetrics } from "@/lib/data";
import { requireCouncilSession } from "@/lib/auth";

export default async function AnalyticsPage() {
  const session = await requireCouncilSession("analytics:view");
  const overview = await dashboardMetrics(session);
  return (
    <>
      <PageHeader
        action={<a className="secondary-button" href="/api/evidence.csv"><Download aria-hidden="true" size={17} /> Export evidence CSV</a>}
        eyebrow="Privacy-preserving evidence"
        title="Evidence & analytics"
        description="Measure whether residents find verified dates, enable reminders, understand local disposal guidance and complete official reporting journeys—without collecting their household address here."
      />
      <section className="metric-grid">
        {overview.metrics.map((metric) => <article className={`metric-card tone-${metric.tone ?? "teal"}`} key={metric.label}><span className="metric-label">{metric.label}</span><strong className="metric-value">{metric.value}</strong><span className="metric-detail">{metric.detail}</span></article>)}
      </section>
      <section className="overview-grid">
        <article className="panel">
          <div className="panel-heading"><h2>What councils can evidence</h2></div>
          <div className="connection-list">
            <div className="connection-row"><div><strong>Resident reach</strong><br /><span>Active, currently linked and all-time random installation IDs among residents who explicitly opted in</span></div></div>
            <div className="connection-row"><div><strong>Service reliability</strong><br /><span>Successful council-gateway checks and average response time</span></div></div>
            <div className="connection-row"><div><strong>Behavioural need</strong><br /><span>Structured guide item keys and matched/no-match outcomes, never raw search text</span></div></div>
            <div className="connection-row"><div><strong>Recovery completion</strong><br /><span>Official handoffs and resident-confirmed submissions, not report narratives</span></div></div>
          </div>
        </article>
        <aside className="panel">
          <ShieldCheck aria-hidden="true" color="#34C759" size={28} />
          <h2 className="space-top-md">Minimum necessary data</h2>
          <p className="form-intro">Exports contain aggregated council metrics only. Low-volume event groups are suppressed to reduce re-identification risk.</p>
          <div className="truth-note">No dashboard claim should be used as a council KPI until the metric definition, consent population and reporting period are agreed in the pilot measurement plan.</div>
        </aside>
      </section>
    </>
  );
}
