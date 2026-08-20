import { Settings2 } from "lucide-react";

import { saveCouncilFeaturesAction, saveCouncilOnboardingItemAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalQueue } from "@/components/operational-queue";
import { OperationalReadiness } from "@/components/operational-readiness";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { getCouncilFeatureFlags, listCouncilOnboardingItems } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";
import { operationalQueueState, type OperationalQueueSearchParams } from "@/lib/operational-queue";
import { councilRoleCan } from "@/lib/permissions";

const featureLabels = {
  collectionDates: "Collection dates",
  councilBranding: "Council branding",
  pushAlerts: "Push alerts",
  missedCollection: "Missed collection",
  directReporting: "Direct reporting",
  recyclingGuide: "Recycling guide",
  partnerServices: "Partner services",
  supportInbox: "Support inbox",
  sponsoredPlus: "Council-sponsored Plus",
  analyticsExports: "Analytics exports",
  bulkyWasteBooking: "Bulky-waste booking",
} as const;

const itemLabels: Record<string, string> = {
  identity: "Council identity",
  "staff-access": "Staff access",
  "collection-source": "Collection source",
  "address-lookup": "Address lookup",
  "bin-names-colours": "Bin names and colours",
  "recycling-guidance": "Recycling guidance",
  "missed-bin-policy": "Missed-bin policy",
  "service-alerts": "Service alerts",
  "partner-approvals": "Partner approvals",
  "pilot-baseline": "Pilot baseline",
};

const itemArea: Record<string, string> = {
  identity: "foundation",
  "staff-access": "governance",
  "collection-source": "integration",
  "address-lookup": "integration",
  "bin-names-colours": "resident-content",
  "recycling-guidance": "resident-content",
  "missed-bin-policy": "resident-content",
  "service-alerts": "operations",
  "partner-approvals": "governance",
  "pilot-baseline": "measurement",
};

const setupStatuses = ["not-started", "in-progress", "complete", "blocked"] as const;
type PageParams = OperationalQueueSearchParams & { error?: string; saved?: string };

export default async function SetupPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canManage = councilRoleCan(session.role, "organisation:manage");
  const [items, flags, params] = await Promise.all([listCouncilOnboardingItems(session), getCouncilFeatureFlags(session), searchParams]);
  const completed = items.filter((item) => item.status === "complete").length;
  const areas = [...new Set(items.map((item) => itemArea[item.itemKey] ?? "other"))];
  const queue = operationalQueueState(items, params, {
    defaultSort: "sequence",
    filterValues: areas,
    getFilter: (item) => itemArea[item.itemKey] ?? "other",
    getSearchText: (item) => [itemLabels[item.itemKey] ?? humanise(item.itemKey), item.itemKey, item.status, item.evidenceNote ?? "", itemArea[item.itemKey] ?? "other"].join(" "),
    getStatus: (item) => item.status,
    sorts: {
      completed: (item) => item.completedAt,
      sequence: (item) => items.findIndex((candidate) => candidate.itemKey === item.itemKey),
      status: (item) => item.status,
      title: (item) => itemLabels[item.itemKey] ?? item.itemKey,
    },
    statusValues: setupStatuses,
  });
  const featureEditor = canManage ? (
    <OperationalDrawer description="A feature flag never invents an integration. Enable a capability only after its backing configuration and operational owner have been verified." title="Manage Resident Capabilities" triggerLabel="Manage Feature Flags" triggerStyle="primary" wide>
      <form action={saveCouncilFeaturesAction} className="stack-form">
        <div className="check-grid feature-flag-grid">{Object.entries(featureLabels).map(([key, label]) => <label className="check-option" key={key}><input defaultChecked={flags[key as keyof typeof flags]} name="features" type="checkbox" value={key} />{label}</label>)}</div>
        <button className="primary-button" type="submit">Save Feature Flags</button>
      </form>
    </OperationalDrawer>
  ) : undefined;

  return (
    <>
      <PageHeader eyebrow="Deployment control" title="Council Setup" description="Operate the real onboarding checklist, expose only approved resident capabilities and make every missing prerequisite visible." />
      <FeedbackBanner error={params.error} saved={params.saved} />
      <section className="panel space-bottom-lg">
        <div className="panel-heading"><div><span className="eyebrow">Onboarding Progress</span><h2>{completed} of {items.length} Setup Items Complete</h2></div><strong>{items.length ? Math.round((completed / items.length) * 100) : 0}%</strong></div>
        <div aria-label={`${completed} of ${items.length} setup items complete`} aria-valuemax={items.length} aria-valuemin={0} aria-valuenow={completed} className="setup-progress" role="progressbar"><span style={{ width: `${items.length ? (completed / items.length) * 100 : 0}%` }} /></div>
      </section>
      <OperationalQueue
        action={featureEditor}
        caption={`Deployment readiness items for ${session.organisation.name}, including current status, evidence or blocker note and recorded completion time.`}
        columns={[
          { label: "Setup Item", sortKey: "title" },
          { label: "Area" },
          { label: "Evidence or Blocker" },
          { label: "Completed", sortKey: "completed" },
          { label: "Status", sortKey: "status" },
          { label: "Actions" },
        ]}
        emptyState={<div className="empty-state"><Settings2 aria-hidden="true" size={32} /><h2>No Matching Setup Items</h2><p>Reset the filters to return to the complete authority checklist.</p></div>}
        filterLabel="areas"
        filterOptions={areas.map((value) => ({ label: humanise(value), value }))}
        pathname="/setup"
        searchLabel="Search setup item, evidence or blocker"
        state={queue}
        statusOptions={setupStatuses.map((value) => ({ label: humanise(value), value }))}
        title="Deployment Readiness Queue"
        viewKey="council-setup"
      >
        {queue.items.map((item) => {
          const label = itemLabels[item.itemKey] ?? humanise(item.itemKey);
          return (
            <tr key={item.itemKey}>
              <td className="queue-primary-cell" data-label="Setup Item"><strong>{label}</strong><small>{item.itemKey}</small></td>
              <td data-label="Area">{humanise(itemArea[item.itemKey] ?? "other")}</td>
              <td data-label="Evidence or Blocker">{item.evidenceNote ?? "No evidence or blocker note recorded"}</td>
              <td data-label="Completed">{item.completedAt ? formatDateTime(item.completedAt) : "Not completed"}</td>
              <td data-label="Status"><StatusPill status={item.status} /></td>
              <td className="queue-cell-actions" data-label="Actions">
                <OperationalDrawer title={label} triggerLabel={canManage ? "Update" : "Review"} triggerStyle="text">
                  {canManage ? (
                    <form action={saveCouncilOnboardingItemAction} className="stack-form">
                      <input name="itemKey" type="hidden" value={item.itemKey} />
                      <div className="field"><label htmlFor={`setup-status-${item.itemKey}`}>Status</label><select defaultValue={item.status} id={`setup-status-${item.itemKey}`} name="status">{setupStatuses.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
                      <div className="field"><label htmlFor={`setup-evidence-${item.itemKey}`}>Evidence or blocker note</label><textarea defaultValue={item.evidenceNote} id={`setup-evidence-${item.itemKey}`} maxLength={1000} name="evidenceNote" placeholder="Record the evidence checked, or the prerequisite blocking launch." /></div>
                      <button className="primary-button" type="submit">Save Setup Item</button>
                    </form>
                  ) : <div className="queue-record-detail"><StatusPill status={item.status} /><p>{item.evidenceNote ?? "No evidence or blocker note has been recorded."}</p><div className="truth-note">Only an organisation owner or administrator can update deployment evidence.</div></div>}
                </OperationalDrawer>
              </td>
            </tr>
          );
        })}
      </OperationalQueue>
      <div className="space-top-lg">
        <OperationalReadiness
          caption="Tenant feature-flag states. Enabled flags still require their separate integration and content prerequisites to be verified."
          rows={Object.entries(featureLabels).map(([key, label]) => ({
            area: label,
            currentState: flags[key as keyof typeof flags] ? "Enabled by the tenant feature flag" : "Disabled by the tenant feature flag",
            nextStep: flags[key as keyof typeof flags] ? "Verify the backing operational page, integration and named owner before launch." : "Complete the related setup evidence before enabling the resident capability.",
            status: flags[key as keyof typeof flags] ? "partial" as const : "unavailable" as const,
          }))}
          title="Resident Capability Readiness"
        />
      </div>
    </>
  );
}
