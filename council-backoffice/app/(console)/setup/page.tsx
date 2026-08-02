import { CheckCircle2, Circle, CircleDashed, ShieldAlert } from "lucide-react";

import { saveCouncilFeaturesAction, saveCouncilOnboardingItemAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { requireCouncilSession } from "@/lib/auth";
import { getCouncilFeatureFlags, listCouncilOnboardingItems } from "@/lib/data";
import { humanise } from "@/lib/format";
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

const statusIcon = {
  "not-started": Circle,
  "in-progress": CircleDashed,
  complete: CheckCircle2,
  blocked: ShieldAlert,
};

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canManage = councilRoleCan(session.role, "organisation:manage");
  const [items, flags, params] = await Promise.all([listCouncilOnboardingItems(session), getCouncilFeatureFlags(session), searchParams]);
  const completed = items.filter((item) => item.status === "complete").length;
  return (
    <>
      <PageHeader eyebrow="Deployment control" title="Council setup" description="See exactly why a council is—or is not—fully live, and expose only the resident capabilities this authority has approved and bought." />
      <FeedbackBanner {...params} />
      <section className="panel space-bottom-lg">
        <div className="panel-heading"><div><span className="eyebrow">ONBOARDING</span><h2>Council setup · {completed} of {items.length}</h2></div><strong>{Math.round((completed / items.length) * 100)}%</strong></div>
        <div className="setup-progress"><span style={{ width: `${(completed / items.length) * 100}%` }} /></div>
        <div className="setup-list">
          {items.map((item) => {
            const Icon = statusIcon[item.status];
            return (
              <form action={saveCouncilOnboardingItemAction} className="setup-row" key={item.itemKey}>
                <Icon aria-hidden="true" className={`setup-icon setup-${item.status}`} size={22} />
                <div className="setup-copy"><strong>{itemLabels[item.itemKey] ?? humanise(item.itemKey)}</strong><input defaultValue={item.evidenceNote} disabled={!canManage} name="evidenceNote" placeholder="Evidence or blocker note" /></div>
                <input name="itemKey" type="hidden" value={item.itemKey} />
                <select defaultValue={item.status} disabled={!canManage} name="status"><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="complete">Complete</option><option value="blocked">Blocked</option></select>
                {canManage ? <button className="secondary-button button-small" type="submit">Save</button> : null}
              </form>
            );
          })}
        </div>
      </section>
      <section className="panel form-panel">
        <div className="panel-heading"><div><span className="eyebrow">FEATURE FLAGS</span><h2>Resident capabilities</h2></div></div>
        <p className="form-intro">Disabled capabilities are removed from the selected council’s resident journey. A flag does not invent an integration; it only exposes a capability that has also been configured.</p>
        <form action={saveCouncilFeaturesAction} className="stack-form">
          <div className="check-grid feature-flag-grid">{Object.entries(featureLabels).map(([key, label]) => <label className="check-option" key={key}><input defaultChecked={flags[key as keyof typeof flags]} disabled={!canManage} name="features" type="checkbox" value={key} />{label}</label>)}</div>
          {canManage ? <button className="primary-button" type="submit">Save feature flags</button> : null}
        </form>
      </section>
    </>
  );
}
