import { BadgePoundSterling, ShieldCheck } from "lucide-react";

import { changePartnerStatusAction, savePartnerAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { listPartners } from "@/lib/data";
import { humanise } from "@/lib/format";
import { councilRoleCan } from "@/lib/permissions";

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canWrite = councilRoleCan(session.role, "partners:write");
  const canApprove = councilRoleCan(session.role, "partners:approve");
  const [items, params] = await Promise.all([listPartners(session), searchParams]);
  return (
    <>
      <PageHeader eyebrow="Useful commercial services" title="Partner services" description="Task-relevant partners only. Official council and free options always appear first, every paid placement is labelled, and activation requires a separate approval role." />
      <FeedbackBanner {...params} />
      <div className="truth-note space-bottom-lg"><ShieldCheck aria-hidden="true" size={17} /> Partner policy: solve the current disposal problem, disclose the commercial relationship and never displace a council service.</div>
      <div className={canWrite ? "split-layout" : ""}>
        {canWrite ? <section className="panel form-panel sticky-panel">
          <h2>Submit a partner for review</h2><p className="form-intro">This form cannot activate a partner. An authorised approver must review licensing, relevance and disclosure first.</p>
          <form action={savePartnerAction} className="stack-form">
            <div className="field"><label htmlFor="name">Partner name</label><input id="name" maxLength={160} name="name" required /></div>
            <div className="field-grid">
              <div className="field"><label htmlFor="category">Category</label><select id="category" name="category">{["bulky-waste", "reuse", "electricals", "batteries", "paint", "garden", "bin-cleaning", "replacement-bins", "other"].map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
              <div className="field"><label htmlFor="status">Workflow</label><select id="status" name="status"><option value="draft">Save draft</option><option value="review">Send for review</option></select></div>
            </div>
            <div className="field"><label htmlFor="description">Resident-facing description</label><textarea id="description" maxLength={400} name="description" required /></div>
            <div className="field"><label htmlFor="serviceUrl">Booking/service URL</label><input id="serviceUrl" name="serviceUrl" required type="url" /></div>
            <div className="field"><label htmlFor="itemKeys">Relevant item keys, one per line</label><textarea id="itemKeys" name="itemKeys" placeholder={"mattress\nbed-frame"} required /></div>
            <div className="field-grid">
              <div className="field"><label htmlFor="disclosureLabel">Disclosure</label><input defaultValue="Sponsored partner" id="disclosureLabel" name="disclosureLabel" required /></div>
              <div className="field"><label htmlFor="referralModel">Commercial model</label><select id="referralModel" name="referralModel">{["none", "flat-fee", "commission", "sponsored-placement"].map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
              <div className="field"><label htmlFor="commissionPence">Commission (pence)</label><input id="commissionPence" min={0} name="commissionPence" type="number" /></div>
              <div className="field"><label htmlFor="priority">Order after council options</label><input defaultValue={100} id="priority" max={1000} min={1} name="priority" required type="number" /></div>
              <div className="field field-span"><label htmlFor="licenceReference">Waste-carrier/licence reference</label><input id="licenceReference" maxLength={120} name="licenceReference" /></div>
              <div className="field"><label htmlFor="startsAt">Starts</label><input id="startsAt" name="startsAt" type="datetime-local" /></div>
              <div className="field"><label htmlFor="endsAt">Ends</label><input id="endsAt" name="endsAt" type="datetime-local" /></div>
            </div>
            <button className="primary-button" type="submit">Save partner</button>
          </form>
        </section> : null}
        <section className="data-list">
          {items.length ? items.map((item) => <article className="data-card" key={item.id}>
            <div className="data-card-top"><div><h2>{item.name}</h2><div className="data-meta"><span>{humanise(item.category)}</span><span>{humanise(item.referralModel)}</span><span>Priority {item.priority}</span></div></div><StatusPill status={item.status} /></div>
            <p>{item.description}</p><div className="tag-list"><span className="tag">{item.disclosureLabel}</span>{item.itemKeys.map((key) => <span className="tag" key={key}>{key}</span>)}</div>
            {canApprove && item.status !== "ended" ? <div className="data-card-actions"><form action={changePartnerStatusAction} className="inline-form"><input name="id" type="hidden" value={item.id} />{item.status !== "active" ? <button className="primary-button button-small" name="status" value="active">Approve & activate</button> : <button className="secondary-button button-small" name="status" value="paused">Pause</button>}<button className="secondary-button button-small" name="status" value="ended">End</button></form></div> : null}
          </article>) : <div className="empty-state"><BadgePoundSterling aria-hidden="true" size={32} /><h2>No partners configured</h2><p>No commercial option will appear in the resident app until a task-relevant service is reviewed and approved.</p></div>}
        </section>
      </div>
    </>
  );
}
