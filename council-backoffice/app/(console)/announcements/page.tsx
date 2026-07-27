import { MessageSquarePlus } from "lucide-react";

import { changeAnnouncementStatusAction, saveAnnouncementAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { listAnnouncements } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";
import { councilRoleCan } from "@/lib/permissions";

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireCouncilSession("dashboard:view");
  const canWrite = councilRoleCan(session.role, "content:write");
  const canPublish = councilRoleCan(session.role, "content:publish");
  const [items, params] = await Promise.all([listAnnouncements(session), searchParams]);
  return (
    <>
      <PageHeader
        eyebrow="Resident communications"
        title="Announcements"
        description="Publish concise, verified information to the resident app. Push and widget broadcasts remain unavailable until those consented channels are connected."
      />
      <FeedbackBanner {...params} />
      <div className={canWrite ? "split-layout" : ""}>
        {canWrite ? (
          <section className="panel form-panel sticky-panel">
            <h2>Create announcement</h2>
            <p className="form-intro">Council services stay first. Every message records who created or published it.</p>
            <form action={saveAnnouncementAction} className="stack-form">
              <div className="field-grid">
                <div className="field"><label htmlFor="kind">Type</label><select id="kind" name="kind"><option value="service">Service update</option><option value="education">Education</option><option value="emergency">Emergency</option><option value="seasonal">Seasonal</option></select></div>
                <div className="field"><label htmlFor="severity">Severity</label><select id="severity" name="severity"><option value="information">Information</option><option value="advice">Advice</option><option value="warning">Warning</option><option value="critical">Critical</option></select></div>
                <div className="field field-span"><label htmlFor="title">Resident-facing title</label><input id="title" maxLength={120} name="title" required /></div>
                <div className="field field-span"><label htmlFor="body">Message</label><textarea id="body" maxLength={600} name="body" required /></div>
                <fieldset className="field field-span"><legend>Resident surfaces</legend><div className="check-grid">{["home", "schedule", "guide"].map((placement) => <label className="check-option" key={placement}><input defaultChecked={placement === "home"} name="placements" type="checkbox" value={placement} />{humanise(placement)}</label>)}</div></fieldset>
                <div className="field"><label htmlFor="startsAt">Starts</label><input id="startsAt" name="startsAt" type="datetime-local" /></div>
                <div className="field"><label htmlFor="endsAt">Ends</label><input id="endsAt" name="endsAt" type="datetime-local" /></div>
                <div className="field field-span"><label htmlFor="sourceUrl">Official source URL</label><input id="sourceUrl" name="sourceUrl" placeholder="https://…" type="url" /></div>
              </div>
              <div className="form-actions">
                <button className="secondary-button" name="status" type="submit" value="draft">Save draft</button>
                {canPublish ? <button className="primary-button" name="status" type="submit" value="published">Publish to app</button> : null}
              </div>
            </form>
          </section>
        ) : null}
        <section className="data-list" aria-label="Council announcements">
          {items.length ? items.map((item) => (
            <article className="data-card" key={item.id}>
              <div className="data-card-top"><div><h2>{item.title}</h2><div className="data-meta"><span>{humanise(item.kind)}</span><span>{humanise(item.severity)}</span><span>Updated {formatDateTime(item.updatedAt)}</span></div></div><StatusPill status={item.status} /></div>
              <p>{item.body}</p>
              <div className="tag-list">{item.placements.map((placement) => <span className="tag" key={placement}>{humanise(placement)}</span>)}</div>
              <div className="data-meta space-top-sm"><span>Starts {formatDateTime(item.startsAt)}</span><span>Ends {formatDateTime(item.endsAt)}</span></div>
              {canPublish && item.status !== "archived" ? <div className="data-card-actions"><form action={changeAnnouncementStatusAction} className="inline-form"><input name="id" type="hidden" value={item.id} />{item.status !== "published" ? <button className="primary-button button-small" name="status" type="submit" value="published">Publish</button> : null}<button className="secondary-button button-small" name="status" type="submit" value="archived">Archive</button></form></div> : null}
            </article>
          )) : <div className="empty-state"><MessageSquarePlus aria-hidden="true" size={32} /><h2>No announcements yet</h2><p>Create the first verified resident message. Nothing will appear in the app until it is explicitly published.</p></div>}
        </section>
      </div>
    </>
  );
}
