import { TriangleAlert } from "lucide-react";

import { changeDisruptionStatusAction, saveDisruptionAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { listCouncilBroadcasts, listDisruptions } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";
import { councilRoleCan } from "@/lib/permissions";

const collectionTypes = ["all", "general", "recycling", "garden", "food", "other"];

export default async function DisruptionsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canWrite = councilRoleCan(session.role, "content:write");
  const canPublish = councilRoleCan(session.role, "content:publish");
  const [items, broadcasts, params] = await Promise.all([
    listDisruptions(session),
    listCouncilBroadcasts(session),
    searchParams,
  ]);
  const broadcastsByContentId = new Map<string, (typeof broadcasts)[number]>();
  broadcasts.forEach((broadcast) => {
    if (!broadcastsByContentId.has(broadcast.contentId)) {
      broadcastsByContentId.set(broadcast.contentId, broadcast);
    }
  });
  return (
    <>
      <PageHeader eyebrow="Operational alerts" title="Service disruptions" description="Tell this council’s residents what has changed, who is affected and exactly what to do next. Publish in-app and optionally send a consented push alert." />
      <FeedbackBanner {...params} />
      <div className={canWrite ? "split-layout" : ""}>
        {canWrite ? <section className="panel form-panel sticky-panel">
          <h2>Record a disruption</h2><p className="form-intro">Use precise resident instructions and an official source whenever possible.</p>
          <form action={saveDisruptionAction} className="stack-form">
            <div className="field"><label htmlFor="title">Title</label><input id="title" maxLength={120} name="title" required /></div>
            <div className="field"><label htmlFor="detail">What happened?</label><textarea id="detail" maxLength={600} name="detail" required /></div>
            <fieldset><legend>Affected collection types</legend><div className="check-grid">{collectionTypes.map((type) => <label className="check-option" key={type}><input defaultChecked={type === "all"} name="collectionTypes" type="checkbox" value={type} />{humanise(type)}</label>)}</div></fieldset>
            <div className="field"><label htmlFor="areaLabels">Affected areas, one per line</label><textarea id="areaLabels" name="areaLabels" /></div>
            <div className="field"><label htmlFor="cause">Cause</label><select id="cause" name="cause">{["operational", "weather", "bank-holiday", "industrial-action", "vehicle", "emergency", "other"].map((cause) => <option key={cause} value={cause}>{humanise(cause)}</option>)}</select></div>
            <div className="field"><label htmlFor="residentInstruction">What should residents do?</label><textarea id="residentInstruction" maxLength={400} name="residentInstruction" required /></div>
            <div className="field-grid"><div className="field"><label htmlFor="startsAt">Starts</label><input id="startsAt" name="startsAt" required type="datetime-local" /></div><div className="field"><label htmlFor="expectedResumeAt">Expected resume</label><input id="expectedResumeAt" name="expectedResumeAt" type="datetime-local" /></div><div className="field"><label htmlFor="endsAt">Ends</label><input id="endsAt" name="endsAt" type="datetime-local" /></div><div className="field"><label htmlFor="sourceUrl">Official source</label><input id="sourceUrl" name="sourceUrl" type="url" /></div></div>
            {canPublish ? <label className="check-option"><input name="sendPush" type="checkbox" value="yes" />Also send a push alert to this council&apos;s opted-in residents</label> : null}
            {canPublish ? <p className="form-help">The in-app warning is available without notification permission. Push sends immediately and only to residents who enabled service alerts. Push is council-wide; area labels do not narrow its recipients.</p> : null}
            <div className="form-actions"><button className="secondary-button" name="status" value="draft">Save draft</button>{canPublish ? <button className="primary-button" name="status" value="published">Publish alert</button> : null}</div>
          </form>
        </section> : null}
        <section className="data-list">
          {items.length ? items.map((item) => <article className="data-card" key={item.id}>
            <div className="data-card-top"><div><h2>{item.title}</h2><div className="data-meta"><span>{humanise(item.cause)}</span><span>From {formatDateTime(item.startsAt)}</span></div></div><StatusPill status={item.status} /></div>
            <p>{item.detail}</p><div className="truth-note space-top-md"><strong>Resident instruction:</strong> {item.residentInstruction}</div>
            <div className="tag-list">{item.collectionTypes.map((type) => <span className="tag" key={type}>{humanise(type)}</span>)}{item.areaLabels.map((area) => <span className="tag" key={area}>{area}</span>)}</div>
            {broadcastsByContentId.get(item.id) ? <div className="data-meta space-top-sm"><span>Push {humanise(broadcastsByContentId.get(item.id)!.status)}</span><span>{broadcastsByContentId.get(item.id)!.acceptedCount} accepted by notification providers</span>{broadcastsByContentId.get(item.id)!.failedCount ? <span>{broadcastsByContentId.get(item.id)!.failedCount} failed or expired</span> : null}</div> : null}
            {canPublish && item.status !== "archived" ? <div className="data-card-actions"><form action={changeDisruptionStatusAction} className="inline-form"><input name="id" type="hidden" value={item.id} />{item.status === "draft" ? <label className="check-option"><input name="sendPush" type="checkbox" value="yes" />Push alert</label> : null}{item.status === "draft" ? <button className="primary-button button-small" name="status" value="published">Publish</button> : null}{item.status === "published" ? <button className="secondary-button button-small" name="status" value="resolved">Resolve</button> : null}<button className="secondary-button button-small" name="status" value="archived">Archive</button></form></div> : null}
          </article>) : <div className="empty-state"><TriangleAlert aria-hidden="true" size={32} /><h2>No disruption alerts</h2><p>There are no council disruption records for this workspace.</p></div>}
        </section>
      </div>
    </>
  );
}
