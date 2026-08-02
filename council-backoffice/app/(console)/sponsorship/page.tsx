import { BadgePoundSterling, ShieldCheck } from "lucide-react";

import { changeSponsorshipProgrammeStatusAction, saveSponsorshipProgrammeAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { listSponsorshipProgrammes } from "@/lib/data";
import { humanise } from "@/lib/format";
import { councilRoleCan } from "@/lib/permissions";

const sponsoredFeatures = [
  ["plus", "What Bin Plus"],
  ["household-sharing", "Household sharing"],
  ["extra-reminders", "Extra reminders"],
  ["collection-history", "Collection history"],
  ["calendar-tools", "Calendar tools"],
] as const;

export default async function SponsorshipPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canManage = councilRoleCan(session.role, "organisation:manage");
  const [programmes, params] = await Promise.all([listSponsorshipProgrammes(session), searchParams]);
  return (
    <>
      <PageHeader eyebrow="Resident entitlement" title="Council-sponsored Plus" description="Include household conveniences for residents whose currently selected place belongs to this authority. Sponsored access is recalculated when the resident changes place." />
      <FeedbackBanner {...params} />
      <div className="truth-note space-bottom-lg"><ShieldCheck aria-hidden="true" size={17} /> Sponsorship unlocks optional conveniences only. Collection dates, council routes and essential alerts remain free.</div>
      <div className={canManage ? "split-layout" : ""}>
        {canManage ? (
          <section className="panel form-panel sticky-panel">
            <h2>Create sponsorship period</h2>
            <p className="form-intro">Only one programme can be active for this council at a time. Activating a new period pauses the previous one.</p>
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
              <button className="primary-button" type="submit">Save programme</button>
            </form>
          </section>
        ) : null}
        <section className="data-list">
          {programmes.length ? programmes.map((programme) => (
            <article className="data-card" key={programme.id}>
              <div className="data-card-top"><div><h2>{programme.residentLabel}</h2><div className="data-meta"><span>{humanise(programme.sponsorType)}</span><span>Starts {new Date(programme.startsAt).toLocaleDateString("en-GB")}</span>{programme.endsAt ? <span>Ends {new Date(programme.endsAt).toLocaleDateString("en-GB")}</span> : <span>No fixed end</span>}</div></div><StatusPill status={programme.status} /></div>
              <div className="tag-list">{programme.features.map((feature) => <span className="tag" key={feature}>{humanise(feature)}</span>)}</div>
              {programme.renewalAt ? <p>Renewal review: {new Date(`${programme.renewalAt}T00:00:00Z`).toLocaleDateString("en-GB")}</p> : null}
              {canManage && programme.status !== "ended" ? <div className="data-card-actions"><form action={changeSponsorshipProgrammeStatusAction} className="inline-form"><input name="id" type="hidden" value={programme.id} />{programme.status !== "active" ? <button className="primary-button button-small" name="status" value="active">Activate</button> : <button className="secondary-button button-small" name="status" value="paused">Pause</button>}<button className="secondary-button button-small" name="status" value="ended">End</button></form></div> : null}
            </article>
          )) : <div className="empty-state"><BadgePoundSterling aria-hidden="true" size={32} /><h2>No sponsored access configured</h2><p>Residents keep the Free service. No paywall is suppressed until an authorised programme is active.</p></div>}
        </section>
      </div>
    </>
  );
}
