import { Download, ShieldCheck } from "lucide-react";

import { savePilotBaselineAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { requireCouncilSession } from "@/lib/auth";
import { dashboardMetrics, getCouncilPilotBaseline } from "@/lib/data";
import type { OutcomeFunnelStage } from "@/lib/types";

function Funnel({ title, stages }: { title: string; stages: OutcomeFunnelStage[] }) {
  const maximum = Math.max(...stages.map((stage) => stage.value), 1);
  return (
    <article className="panel">
      <div className="panel-heading"><h2>{title}</h2><span className="data-meta">Last 30 days</span></div>
      <div className="funnel-list">
        {stages.map((stage) => (
          <div className="funnel-row" key={stage.label}>
            <div className="funnel-copy"><strong>{stage.label}</strong><span>{stage.detail}</span></div>
            <div className="funnel-value"><strong>{stage.value.toLocaleString("en-GB")}</strong><span aria-hidden="true" className="funnel-track"><i style={{ width: `${Math.max(3, Math.round((stage.value / maximum) * 100))}%` }} /></span></div>
          </div>
        ))}
      </div>
    </article>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireCouncilSession("analytics:view");
  const [overview, baseline, params] = await Promise.all([
    dashboardMetrics(session),
    getCouncilPilotBaseline(session),
    searchParams,
  ]);
  return (
    <>
      <PageHeader
        action={<a className="secondary-button" href="/api/evidence.csv"><Download aria-hidden="true" size={17} /> Export evidence CSV</a>}
        eyebrow="Privacy-preserving evidence"
        title="Outcomes & analytics"
        description="Follow the complete resident journey without exposing household addresses. Counts are observed product events, not estimated financial savings."
      />
      <FeedbackBanner {...params} />
      <section className="metric-grid">
        {overview.metrics.map((metric) => <article className={`metric-card tone-${metric.tone ?? "teal"}`} key={metric.label}><span className="metric-label">{metric.label}</span><strong className="metric-value">{metric.value}</strong><span className="metric-detail">{metric.detail}</span></article>)}
      </section>
      <section className="analytics-funnel-grid">
        <Funnel stages={overview.outcomeFunnels.collection} title="Collection journey" />
        <Funnel stages={overview.outcomeFunnels.guide} title="Guide journey" />
        <Funnel stages={overview.outcomeFunnels.communications} title="Communications" />
      </section>
      <section className="overview-grid">
        <article className="panel">
          <div className="panel-heading"><h2>Pilot baseline</h2></div>
          <p className="form-intro">Enter only a council-agreed baseline. Estimated value remains hidden unless an agreed contact cost is supplied.</p>
          <form action={savePilotBaselineAction} className="stack-form">
            <div className="field-grid">
              <div className="field"><label htmlFor="periodStartsOn">Baseline starts</label><input defaultValue={baseline?.periodStartsOn} id="periodStartsOn" name="periodStartsOn" required type="date" /></div>
              <div className="field"><label htmlFor="periodEndsOn">Baseline ends</label><input defaultValue={baseline?.periodEndsOn} id="periodEndsOn" name="periodEndsOn" required type="date" /></div>
              <div className="field"><label htmlFor="residentContacts">All resident contacts</label><input defaultValue={baseline?.residentContacts} id="residentContacts" min={0} name="residentContacts" type="number" /></div>
              <div className="field"><label htmlFor="missedCollectionContacts">Missed-bin contacts</label><input defaultValue={baseline?.missedCollectionContacts} id="missedCollectionContacts" min={0} name="missedCollectionContacts" type="number" /></div>
              <div className="field field-span"><label htmlFor="agreedContactCostPence">Agreed contact cost (pence)</label><input defaultValue={baseline?.agreedContactCostPence} id="agreedContactCostPence" min={0} name="agreedContactCostPence" type="number" /></div>
            </div>
            <div className="field"><label htmlFor="notes">Measurement notes</label><textarea defaultValue={baseline?.notes} id="notes" maxLength={1000} name="notes" /></div>
            <button className="primary-button" type="submit">Save agreed baseline</button>
          </form>
        </article>
        <aside className="panel">
          <ShieldCheck aria-hidden="true" color="#34C759" size={28} />
          <h2 className="space-top-md">Minimum necessary data</h2>
          <p className="form-intro">Exports contain aggregated council metrics only. Low-volume event groups are suppressed to reduce re-identification risk.</p>
          <div className="truth-note">No dashboard claim should be used as a council KPI until the metric definition, consent population and comparison period are agreed in the pilot plan.</div>
        </aside>
      </section>
    </>
  );
}
