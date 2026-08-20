import { Download, ShieldCheck } from "lucide-react";

import { savePilotBaselineAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalReadiness } from "@/components/operational-readiness";
import { PageHeader } from "@/components/page-header";
import { requireCouncilSession } from "@/lib/auth";
import { analyticsPeriods, dashboardMetrics, getCouncilPilotBaseline, normaliseAnalyticsPeriod } from "@/lib/data";
import { councilRoleCan } from "@/lib/permissions";
import type { OutcomeFunnelStage } from "@/lib/types";

function Funnel({ periodDays, title, stages }: { periodDays: number; title: string; stages: OutcomeFunnelStage[] }) {
  const maximum = Math.max(...stages.map((stage) => stage.value), 1);
  return (
    <article className="panel">
      <div className="panel-heading"><h2>{title}</h2><span className="data-meta">Last {periodDays} days</span></div>
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

type PageParams = { error?: string; period?: string; saved?: string };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const session = await requireCouncilSession("analytics:view");
  const params = await searchParams;
  const periodDays = normaliseAnalyticsPeriod(params.period);
  const canExport = councilRoleCan(session.role, "analytics:export");
  const [overview, baseline] = await Promise.all([
    dashboardMetrics(session, periodDays),
    getCouncilPilotBaseline(session),
  ]);
  const baselineEditor = (
    <OperationalDrawer description="Enter only a council-agreed baseline. Estimated value remains hidden unless an agreed contact cost is supplied." title="Edit Pilot Baseline" triggerLabel="Edit Baseline" triggerStyle="primary" wide>
      <form action={savePilotBaselineAction} className="stack-form">
        <div className="field-grid">
          <div className="field"><label htmlFor="periodStartsOn">Baseline starts</label><input defaultValue={baseline?.periodStartsOn} id="periodStartsOn" name="periodStartsOn" required type="date" /></div>
          <div className="field"><label htmlFor="periodEndsOn">Baseline ends</label><input defaultValue={baseline?.periodEndsOn} id="periodEndsOn" name="periodEndsOn" required type="date" /></div>
          <div className="field"><label htmlFor="residentContacts">All resident contacts</label><input defaultValue={baseline?.residentContacts} id="residentContacts" min={0} name="residentContacts" type="number" /></div>
          <div className="field"><label htmlFor="missedCollectionContacts">Missed-bin contacts</label><input defaultValue={baseline?.missedCollectionContacts} id="missedCollectionContacts" min={0} name="missedCollectionContacts" type="number" /></div>
          <div className="field field-span"><label htmlFor="agreedContactCostPence">Agreed contact cost (pence)</label><input defaultValue={baseline?.agreedContactCostPence} id="agreedContactCostPence" min={0} name="agreedContactCostPence" type="number" /></div>
        </div>
        <div className="field"><label htmlFor="notes">Measurement notes</label><textarea defaultValue={baseline?.notes} id="notes" maxLength={1000} name="notes" /></div>
        <button className="primary-button" type="submit">Save Agreed Baseline</button>
      </form>
    </OperationalDrawer>
  );

  return (
    <>
      <PageHeader eyebrow="Privacy-preserving evidence" title="Outcomes & Analytics" description="Review a consistent source-backed period without exposing household addresses. Counts are observed product events, not estimated financial savings." />
      <FeedbackBanner error={params.error} saved={params.saved} />
      <form className="operational-filter-bar analytics-period-filter" method="get">
        <div className="field"><label htmlFor="analytics-period">Reporting period</label><select defaultValue={periodDays} id="analytics-period" name="period">{analyticsPeriods.map((value) => <option key={value} value={value}>Last {value} days</option>)}</select></div>
        <button className="primary-button button-small" type="submit">Apply Period</button>
      </form>
      <section className="metric-grid">
        {overview.metrics.map((metric) => <article className={`metric-card tone-${metric.tone ?? "teal"}`} key={metric.label}><span className="metric-label">{metric.label}</span><strong className="metric-value">{metric.value}</strong><span className="metric-detail">{metric.detail}</span></article>)}
      </section>
      <section className="analytics-funnel-grid">
        <Funnel periodDays={periodDays} stages={overview.outcomeFunnels.collection} title="Collection Journey" />
        <Funnel periodDays={periodDays} stages={overview.outcomeFunnels.guide} title="Guide Journey" />
        <Funnel periodDays={periodDays} stages={overview.outcomeFunnels.communications} title="Communications" />
      </section>
      <OperationalReadiness
        action={<div className="inline-form">{baselineEditor}{canExport ? <a className="secondary-button button-small" href={`/api/evidence.csv?period=${periodDays}`}><Download aria-hidden="true" size={17} /> Export Evidence CSV</a> : null}</div>}
        caption={`Metric definitions and analytic prerequisites for the selected ${periodDays}-day reporting period.`}
        rows={[
          { area: "Resident adoption", currentState: "Anonymous participant links supply active, current and all-time counts", status: "available", nextStep: "Use the displayed definition; do not equate installations with population or households." },
          { area: "Reminder adoption", currentState: "Calculated from observed verified-reminder events and participant counts", status: "available", nextStep: "Treat no-data and low-volume suppression as distinct from zero adoption." },
          { area: "Collection outcome funnel", currentState: "Observed events are counted across the selected period", status: "available", nextStep: "Preserve event-definition versioning when instrumentation changes." },
          { area: "Council contact baseline", currentState: baseline ? `Agreed period ${baseline.periodStartsOn} to ${baseline.periodEndsOn}` : "No council-agreed pilot baseline is stored", status: baseline ? "partial" : "prerequisite-required", nextStep: baseline ? "Review scope, notes and source with the council before comparison." : "Record a council-agreed source period before making a comparative claim." },
          { area: "Previous-period comparison", currentState: "No governed comparison or significance contract is implemented", status: "unavailable", nextStep: "Define comparable cohorts, instrumentation version and confidence rules before adding deltas." },
          { area: "Collections tomorrow", currentState: "Council round or property-count feed not connected", status: "unavailable", nextStep: "Connect and verify an authority-approved aggregate feed; do not estimate the count." },
          { area: "Export evidence", currentState: canExport ? `CSV uses the same ${periodDays}-day server query and includes definitions and availability state` : "Your role can view analytics but cannot export council evidence", status: canExport ? "available" : "unavailable", nextStep: canExport ? "Retain the selected period and metric definitions with any evidence pack." : "Ask an authorised council analytics exporter to prepare the evidence pack." },
        ]}
        title="Metric Definition Register"
      />
      <div className="truth-note space-top-lg"><ShieldCheck aria-hidden="true" size={17} /> Exports contain aggregated council metrics only. Low-volume groups are suppressed to reduce re-identification risk. No value should be used as a council KPI until its population and comparison method are agreed.</div>
    </>
  );
}
