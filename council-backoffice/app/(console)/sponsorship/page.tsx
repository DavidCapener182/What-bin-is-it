import { BadgePoundSterling, ShieldCheck } from "lucide-react";

import { changeSponsorshipProgrammeStatusAction, saveSponsorshipProgrammeAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalQueue } from "@/components/operational-queue";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { listSponsorshipProgrammesPage } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";
import { operationalQueueStateFromServerPage, type OperationalQueueSearchParams } from "@/lib/operational-queue";
import { councilRoleCan } from "@/lib/permissions";

const sponsoredFeatures = [
  ["plus", "What Bin Plus"],
  ["household-sharing", "Household sharing"],
  ["extra-reminders", "Extra reminders"],
  ["collection-history", "Collection history"],
  ["calendar-tools", "Calendar tools"],
] as const;

type PageParams = OperationalQueueSearchParams & { error?: string; saved?: string };

export default async function SponsorshipPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canManage = councilRoleCan(session.role, "organisation:manage");
  const params = await searchParams;
  const serverPage = await listSponsorshipProgrammesPage(session, params);
  const queue = operationalQueueStateFromServerPage(serverPage);
  const statuses = ["draft", "active", "paused", "ended"] as const;
  const sponsorTypes = ["council", "housing"] as const;

  const composer = canManage ? (
    <OperationalDrawer
      description="Only one programme can be active for this council at a time. Activating a new period pauses the previous one."
      title="Create Sponsorship Period"
      triggerLabel="Create Programme"
      triggerStyle="primary"
      wide
    >
      <form action={saveSponsorshipProgrammeAction} className="stack-form">
        <div className="field-grid">
          <div className="field"><label htmlFor="sponsorType">Sponsor</label><select id="sponsorType" name="sponsorType"><option value="council">Council</option><option value="housing">Housing provider</option></select></div>
          <div className="field"><label htmlFor="status">Launch state</label><select id="status" name="status"><option value="draft">Draft</option><option value="active">Activate</option></select></div>
          <div className="field field-span"><label htmlFor="residentLabel">Resident-facing wording</label><input defaultValue={`Provided by ${session.organisation.name}`} id="residentLabel" maxLength={160} name="residentLabel" required /></div>
        </div>
        <fieldset><legend>Included features</legend><div className="check-grid">{sponsoredFeatures.map(([value, label]) => <label className="check-option" key={value}><input defaultChecked={value === "plus"} name="features" type="checkbox" value={value} />{label}</label>)}</div></fieldset>
        <div className="field-grid">
          <div className="field"><label htmlFor="startsAt">Starts</label><input id="startsAt" name="startsAt" required type="datetime-local" /></div>
          <div className="field"><label htmlFor="endsAt">Ends</label><input id="endsAt" name="endsAt" type="datetime-local" /></div>
          <div className="field"><label htmlFor="renewalAt">Renewal review</label><input id="renewalAt" name="renewalAt" type="date" /></div>
        </div>
        <button className="primary-button" type="submit">Save Programme</button>
      </form>
    </OperationalDrawer>
  ) : undefined;

  return (
    <>
      <PageHeader eyebrow="Resident entitlement" title="Council-Sponsored Plus" description="Operate real sponsorship periods for residents whose selected place belongs to this authority. Sponsored access is recalculated when the resident changes place." />
      <FeedbackBanner error={params.error} saved={params.saved} />
      <div className="truth-note space-bottom-lg"><ShieldCheck aria-hidden="true" size={17} /> Sponsorship unlocks optional conveniences only. Collection dates, council routes and essential alerts remain free.</div>
      <OperationalQueue
        action={composer}
        caption={`Council-sponsored Plus periods for ${session.organisation.name}, including their resident wording, schedule, renewal date and current lifecycle state.`}
        columns={[
          { label: "Programme", sortKey: "label" },
          { label: "Sponsor" },
          { label: "Schedule", sortKey: "starts" },
          { label: "Renewal Review", sortKey: "renewal" },
          { label: "Status" },
          { label: "Actions" },
        ]}
        emptyState={<div className="empty-state"><BadgePoundSterling aria-hidden="true" size={32} /><h2>No Matching Programmes</h2><p>Residents keep the Free service. No paywall is suppressed until an authorised programme is active.</p></div>}
        filterLabel="sponsors"
        filterOptions={sponsorTypes.map((value) => ({ label: humanise(value), value }))}
        pathname="/sponsorship"
        searchLabel="Search wording, sponsor or feature"
        state={queue}
        statusOptions={statuses.map((value) => ({ label: humanise(value), value }))}
        title="Sponsorship Programmes"
        viewKey="sponsorship-programmes"
      >
        {queue.items.map((programme) => (
          <tr key={programme.id}>
            <td className="queue-primary-cell" data-label="Programme"><strong>{programme.residentLabel}</strong><small>{programme.features.length} included feature{programme.features.length === 1 ? "" : "s"}</small></td>
            <td data-label="Sponsor">{humanise(programme.sponsorType)}</td>
            <td data-label="Schedule">{formatDateTime(programme.startsAt)}<small>{programme.endsAt ? `Ends ${formatDateTime(programme.endsAt)}` : "No fixed end"}</small></td>
            <td data-label="Renewal Review">{programme.renewalAt ? new Date(`${programme.renewalAt}T00:00:00Z`).toLocaleDateString("en-GB") : "Not scheduled"}</td>
            <td data-label="Status"><StatusPill status={programme.status} /></td>
            <td className="queue-cell-actions" data-label="Actions">
              <OperationalDrawer title={programme.residentLabel} triggerLabel="Review" triggerStyle="text">
                <div className="queue-record-detail">
                  <StatusPill status={programme.status} />
                  <dl className="queue-detail-list">
                    <div><dt>Sponsor</dt><dd>{humanise(programme.sponsorType)}</dd></div>
                    <div><dt>Resident wording</dt><dd>{programme.residentLabel}</dd></div>
                    <div><dt>Starts</dt><dd>{formatDateTime(programme.startsAt)}</dd></div>
                    <div><dt>Ends</dt><dd>{programme.endsAt ? formatDateTime(programme.endsAt) : "No fixed end"}</dd></div>
                    <div><dt>Renewal review</dt><dd>{programme.renewalAt ?? "Not scheduled"}</dd></div>
                    <div><dt>Included features</dt><dd>{programme.features.length ? programme.features.map(humanise).join(", ") : "None recorded"}</dd></div>
                  </dl>
                  {canManage && programme.status !== "ended" ? <form action={changeSponsorshipProgrammeStatusAction} className="inline-form queue-record-actions"><input name="id" type="hidden" value={programme.id} />{programme.status !== "active" ? <button className="primary-button button-small" name="status" value="active">Activate</button> : <button className="secondary-button button-small" name="status" value="paused">Pause</button>}<button className="secondary-button button-small" name="status" value="ended">End</button></form> : null}
                </div>
              </OperationalDrawer>
            </td>
          </tr>
        ))}
      </OperationalQueue>
      <div className="truth-note space-top-lg">Budget drawdown, invoice reconciliation and renewal ownership are not stored by the current sponsorship schema. This queue therefore reports only configured eligibility periods and does not imply financial reconciliation.</div>
    </>
  );
}
