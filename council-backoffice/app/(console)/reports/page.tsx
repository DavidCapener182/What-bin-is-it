import { ExternalLink, ShieldCheck } from "lucide-react";

import { saveReportingRuleAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalReadiness } from "@/components/operational-readiness";
import { PageHeader } from "@/components/page-header";
import { requireCouncilSession } from "@/lib/auth";
import { getReportingRule } from "@/lib/data";
import { humanise } from "@/lib/format";
import { councilRoleCan } from "@/lib/permissions";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canWrite = councilRoleCan(session.role, "reports:write");
  const [rule, params] = await Promise.all([getReportingRule(session), searchParams]);
  const editor = canWrite ? (
    <OperationalDrawer description="Changes are organisation-scoped and written to the audit trail. Direct submission remains unavailable without a separately approved integration." title="Configure Resident Reporting" triggerLabel="Configure Workflow" triggerStyle="primary" wide>
      <form action={saveReportingRuleAction} className="stack-form">
        <div className="field-grid">
          <label className="check-option"><input defaultChecked={rule.enabled} name="enabled" type="checkbox" /> Enable missed-collection journey</label>
          <label className="check-option"><input defaultChecked={rule.requireDelayCheck} name="requireDelayCheck" type="checkbox" /> Check active disruption notices first</label>
          <div className="field"><label htmlFor="mode">Submission mode</label><select defaultValue={rule.mode === "direct-api" ? "official-handoff" : rule.mode} id="mode" name="mode"><option value="official-handoff">Official council handoff</option><option value="disabled">Disabled</option></select></div>
          <div className="field"><label htmlFor="reportUrl">Official report URL</label><input defaultValue={rule.reportUrl} id="reportUrl" name="reportUrl" type="url" /></div>
          <div className="field"><label htmlFor="eligibilityStartsHours">Hours after collection day begins</label><input defaultValue={rule.eligibilityStartsHours} id="eligibilityStartsHours" max={72} min={0} name="eligibilityStartsHours" required type="number" /></div>
          <div className="field"><label htmlFor="reportingDeadlineHours">Deadline (hours)</label><input defaultValue={rule.reportingDeadlineHours} id="reportingDeadlineHours" max={720} min={1} name="reportingDeadlineHours" required type="number" /></div>
          <div className="field field-span"><label htmlFor="residentInstruction">Council instruction</label><textarea defaultValue={rule.residentInstruction} id="residentInstruction" maxLength={500} name="residentInstruction" /></div>
          <div className="field field-span"><label htmlFor="integrationSecretRef">Reserved server secret reference</label><input defaultValue={rule.integrationSecretRef} id="integrationSecretRef" name="integrationSecretRef" placeholder="BIN_COUNCIL_EXAMPLE_REPORT_API_KEY" /><small>Leave blank for the official handoff. Secret values never belong in this browser form.</small></div>
        </div>
        <button className="primary-button" type="submit">Save Missed-Collection Workflow</button>
      </form>
    </OperationalDrawer>
  ) : undefined;
  const officialHandoffReady = Boolean(rule.enabled && rule.mode === "official-handoff" && rule.reportUrl);

  return (
    <>
      <PageHeader eyebrow="Resident recovery journey" title="Missed Collections" description="Operate eligibility, delay checks and the official council handoff without storing household report details in this console." />
      <FeedbackBanner error={params.error} saved={params.saved} />
      <OperationalReadiness
        action={editor}
        caption={`The configured missed-collection workflow for ${session.organisation.name}, including current resident behaviour and unavailable integration prerequisites.`}
        rows={[
          { area: "Resident journey", currentState: rule.enabled ? "Enabled for this authority" : "Disabled for this authority", status: rule.enabled ? "available" : "unavailable", nextStep: rule.enabled ? "Keep the instructions and official route under operational review." : "Complete policy and handoff evidence before enabling." },
          { area: "Eligibility window", currentState: `Opens ${rule.eligibilityStartsHours} hours after collection day begins; closes after ${rule.reportingDeadlineHours} hours`, status: "available", nextStep: "Verify these values against the council's current published policy." },
          { area: "Delay suppression", currentState: rule.requireDelayCheck ? "Active disruption instructions are checked first" : "No disruption check is required", status: rule.requireDelayCheck ? "available" : "partial", nextStep: rule.requireDelayCheck ? "Maintain current disruption notices and resident instructions." : "Confirm that bypassing active delays is an approved council policy." },
          { area: "Official handoff", currentState: rule.reportUrl ? `${humanise(rule.mode)} route configured` : "No official report URL configured", status: officialHandoffReady ? "available" : "prerequisite-required", nextStep: officialHandoffReady ? "Test the external route after each council website change." : "Supply and verify the official council report URL." },
          { area: "Direct API submission", currentState: "Not exposed by this console, even if a legacy rule contains a direct-api value", status: "unavailable", nextStep: "Requires an approved endpoint, data-processing terms, server-only credential, idempotency and end-to-end tests." },
          { area: "Submission reconciliation", currentState: "Only privacy-safe handoff and resident-confirmed events are represented", status: "partial", nextStep: "Add a council-approved acknowledgement contract before claiming confirmed back-office receipt." },
        ]}
        title="Reporting Workflow Readiness"
      />
      {rule.reportUrl ? <a className="secondary-button space-top-lg" href={rule.reportUrl} rel="noreferrer" target="_blank">Open Official Report Service <ExternalLink aria-hidden="true" size={16} /></a> : null}
      <div className="truth-note space-top-lg"><ShieldCheck aria-hidden="true" size={17} /> The app can prefill due date and bin type in the resident session. This platform stores only privacy-safe events such as an official handoff or resident-confirmed submission.</div>
    </>
  );
}
