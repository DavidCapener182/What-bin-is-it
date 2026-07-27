import { ClipboardCheck, ExternalLink, ShieldCheck } from "lucide-react";

import { saveReportingRuleAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { requireCouncilSession } from "@/lib/auth";
import { getReportingRule } from "@/lib/data";
import { humanise } from "@/lib/format";
import { councilRoleCan } from "@/lib/permissions";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canWrite = councilRoleCan(session.role, "reports:write");
  const [rule, params] = await Promise.all([getReportingRule(session), searchParams]);
  return (
    <>
      <PageHeader eyebrow="Resident recovery journey" title="Missed collections" description="Configure when a resident becomes eligible, check live delay notices first and hand off to the official council service without storing household report details in this console." />
      <FeedbackBanner {...params} />
      <section className="overview-grid">
        <article className="panel">
          <div className="panel-heading"><h2>Current workflow</h2><ClipboardCheck aria-hidden="true" color="#007AFF" size={23} /></div>
          <div className="connection-list">
            <div className="connection-row"><div><strong>{rule.enabled ? "Resident reporting enabled" : "Resident reporting disabled"}</strong><br /><span>{humanise(rule.mode)}</span></div><strong>{rule.enabled ? "ON" : "OFF"}</strong></div>
            <div className="connection-row"><div><strong>Eligibility opens</strong><br /><span>Hours after the collection day begins</span></div><strong>{rule.eligibilityStartsHours}h</strong></div>
            <div className="connection-row"><div><strong>Reporting deadline</strong><br /><span>After the due collection</span></div><strong>{rule.reportingDeadlineHours}h</strong></div>
            <div className="connection-row"><div><strong>Delay suppression</strong><br /><span>Active disruption instructions are checked first</span></div><strong>{rule.requireDelayCheck ? "Required" : "Off"}</strong></div>
          </div>
          {rule.reportUrl ? <a className="secondary-button space-top-md" href={rule.reportUrl} rel="noreferrer" target="_blank">Open official report service <ExternalLink aria-hidden="true" size={16} /></a> : null}
        </article>
        <aside className="panel">
          <div className="panel-heading"><h2>Resident data boundary</h2><ShieldCheck aria-hidden="true" color="#34C759" size={23} /></div>
          <p className="form-intro">The app can prefill the due date and bin type in the resident’s session. This platform stores only privacy-safe events such as an official handoff or resident-confirmed submission.</p>
          <div className="truth-note">Direct API submission remains unavailable until the council supplies an approved endpoint, data-processing terms and a named secret reference.</div>
        </aside>
      </section>
      {canWrite ? <section className="panel form-panel space-top-lg">
        <h2>Configure resident reporting</h2><p className="form-intro">Changes are organisation-scoped and written to the audit trail.</p>
        <form action={saveReportingRuleAction} className="stack-form">
          <div className="field-grid">
            <label className="check-option"><input defaultChecked={rule.enabled} name="enabled" type="checkbox" /> Enable missed-collection journey</label>
            <label className="check-option"><input defaultChecked={rule.requireDelayCheck} name="requireDelayCheck" type="checkbox" /> Check active disruption notices first</label>
            <div className="field"><label htmlFor="mode">Submission mode</label><select defaultValue={rule.mode === "direct-api" ? "official-handoff" : rule.mode} id="mode" name="mode"><option value="official-handoff">Official council handoff</option><option value="disabled">Disabled</option></select></div>
            <div className="field"><label htmlFor="reportUrl">Official report URL</label><input defaultValue={rule.reportUrl} id="reportUrl" name="reportUrl" type="url" /></div>
            <div className="field"><label htmlFor="eligibilityStartsHours">Hours after collection day begins</label><input defaultValue={rule.eligibilityStartsHours} id="eligibilityStartsHours" max={72} min={0} name="eligibilityStartsHours" required type="number" /></div>
            <div className="field"><label htmlFor="reportingDeadlineHours">Deadline (hours)</label><input defaultValue={rule.reportingDeadlineHours} id="reportingDeadlineHours" max={720} min={1} name="reportingDeadlineHours" required type="number" /></div>
            <div className="field field-span"><label htmlFor="residentInstruction">Council instruction</label><textarea defaultValue={rule.residentInstruction} id="residentInstruction" maxLength={500} name="residentInstruction" /></div>
            <div className="field field-span"><label htmlFor="integrationSecretRef">Reserved server secret reference</label><input defaultValue={rule.integrationSecretRef} id="integrationSecretRef" name="integrationSecretRef" placeholder="BIN_COUNCIL_EXAMPLE_REPORT_API_KEY" /><small>Leave blank for the official handoff. A direct council API is enabled only through a separately tested integration project.</small></div>
          </div>
          <button className="primary-button" type="submit">Save missed-collection workflow</button>
        </form>
      </section> : null}
    </>
  );
}
