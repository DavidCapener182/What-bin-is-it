import { TriangleAlert } from "lucide-react";

import { changeDisruptionStatusAction, saveDisruptionAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { CouncilMessagePreview } from "@/components/council-message-preview";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { listCouncilBroadcasts, listDisruptions } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";
import { publishedDisruptionContexts } from "@/lib/message-preview";
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
          <form action={saveDisruptionAction} className="stack-form" id="disruption-compose">
            <input name="expectedOrganisationId" type="hidden" value={session.organisation.id} />
            <div className="field"><label htmlFor="title">Title</label><input id="title" maxLength={120} name="title" required /></div>
            <div className="field"><label htmlFor="detail">What happened?</label><textarea id="detail" maxLength={600} name="detail" required /></div>
            <fieldset><legend>Affected collection types</legend><div className="check-grid">{collectionTypes.map((type) => <label className="check-option" key={type}><input defaultChecked={type === "all"} name="collectionTypes" type="checkbox" value={type} />{humanise(type)}</label>)}</div></fieldset>
            <div className="field"><label htmlFor="areaLabels">Affected areas, one per line</label><textarea id="areaLabels" name="areaLabels" /></div>
            <fieldset><legend>Notification audience</legend><div className="check-grid"><label className="check-option"><input defaultChecked name="audienceScope" type="radio" value="council" />All opted-in residents</label><label className="check-option"><input name="audienceScope" type="radio" value="targeted" />Only matching residents</label></div></fieldset>
            <fieldset><legend>Target collection types</legend><div className="check-grid">{collectionTypes.filter((type) => type !== "all").map((type) => <label className="check-option" key={type}><input name="audienceCollectionTypes" type="checkbox" value={type} />{humanise(type)}</label>)}</div></fieldset>
            <div className="field"><label htmlFor="audienceCollectionDates">Target collection dates, one per line</label><textarea id="audienceCollectionDates" name="audienceCollectionDates" placeholder="2026-08-03" /></div>
            <div className="field"><label htmlFor="audienceLabels">Approved round or ward labels, one per line</label><textarea id="audienceLabels" name="audienceLabels" /><span className="help-text">Labels match only when the council feed registers the same non-address operational label.</span></div>
            <div className="field"><label htmlFor="cause">Cause</label><select id="cause" name="cause">{["operational", "weather", "bank-holiday", "industrial-action", "vehicle", "emergency", "other"].map((cause) => <option key={cause} value={cause}>{humanise(cause)}</option>)}</select></div>
            <div className="field"><label htmlFor="residentInstruction">What should residents do?</label><textarea id="residentInstruction" maxLength={400} name="residentInstruction" required /></div>
            <div className="field-grid"><div className="field"><label htmlFor="startsAt">Starts</label><input id="startsAt" name="startsAt" required type="datetime-local" /></div><div className="field"><label htmlFor="expectedResumeAt">Expected resume</label><input id="expectedResumeAt" name="expectedResumeAt" type="datetime-local" /></div><div className="field"><label htmlFor="endsAt">Ends</label><input id="endsAt" name="endsAt" type="datetime-local" /></div><div className="field"><label htmlFor="sourceUrl">Official source</label><input id="sourceUrl" name="sourceUrl" type="url" /></div></div>
            {canPublish ? <label className="check-option"><input name="sendPush" type="checkbox" value="yes" />Also send a push alert to the selected opted-in audience</label> : null}
            {canPublish ? <label className="check-option"><input name="confirmAudience" type="checkbox" value="yes" />I reviewed the audience and message preview</label> : null}
            {canPublish ? <label className="council-action-confirmation"><input name="confirmCouncilAction" type="checkbox" value="yes" /><span><strong>Confirm {session.organisation.name}</strong><small>Required when publishing this disruption to residents. Drafts do not need confirmation.</small></span></label> : null}
            {canPublish ? <p className="form-help">The in-app warning is available without notification permission. Push sends immediately. Collection type and date matching work now; round or ward labels activate only when an approved feed supplies the same privacy-safe label.</p> : null}
            <div className="form-actions"><button className="secondary-button" name="status" value="draft">Save draft</button>{canPublish ? <button className="primary-button" name="status" value="published">Publish alert</button> : null}</div>
          </form>
          <CouncilMessagePreview
            activeDisruptions={publishedDisruptionContexts(items)}
            councilName={session.organisation.name}
            existingTitles={items.map((item) => item.title)}
            formId="disruption-compose"
            mode="disruption"
          />
        </section> : null}
        <section className="data-list">
          {items.length ? items.map((item) => <article className="data-card" key={item.id}>
            <div className="data-card-top"><div><h2>{item.title}</h2><div className="data-meta"><span>{humanise(item.cause)}</span><span>From {formatDateTime(item.startsAt)}</span></div></div><StatusPill status={item.status} /></div>
            <p>{item.detail}</p><div className="truth-note space-top-md"><strong>Resident instruction:</strong> {item.residentInstruction}</div>
            <div className="tag-list">{item.collectionTypes.map((type) => <span className="tag" key={type}>{humanise(type)}</span>)}{item.areaLabels.map((area) => <span className="tag" key={area}>{area}</span>)}</div>
            {broadcastsByContentId.get(item.id) ? <div className="data-meta space-top-sm"><span>Push {humanise(broadcastsByContentId.get(item.id)!.status)}</span><span>{broadcastsByContentId.get(item.id)!.estimatedRecipientCount} estimated opted-in installations</span><span>{broadcastsByContentId.get(item.id)!.acceptedCount} accepted by notification providers</span>{broadcastsByContentId.get(item.id)!.failedCount ? <span>{broadcastsByContentId.get(item.id)!.failedCount} failed or expired</span> : null}</div> : null}
            {canPublish && item.status !== "archived" ? <div className="data-card-actions"><form action={changeDisruptionStatusAction} className="stack-form"><input name="expectedOrganisationId" type="hidden" value={session.organisation.id} /><input name="id" type="hidden" value={item.id} />{item.status === "draft" ? <label className="check-option"><input name="sendPush" type="checkbox" value="yes" />Push alert</label> : null}{item.status === "draft" ? <label className="check-option"><input name="confirmAudience" type="checkbox" value="yes" />Audience checked</label> : null}{item.status === "draft" ? <label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" type="checkbox" value="yes" /><span><strong>Publish for {session.organisation.name}</strong><small>Confirm this is the intended council workspace.</small></span></label> : null}<div className="inline-form">{item.status === "draft" ? <button className="primary-button button-small" name="status" value="published">Publish</button> : null}{item.status === "published" ? <button className="secondary-button button-small" name="status" value="resolved">Resolve</button> : null}<button className="secondary-button button-small" name="status" value="archived">Archive</button></div></form></div> : null}
          </article>) : <div className="empty-state"><TriangleAlert aria-hidden="true" size={32} /><h2>No disruption alerts</h2><p>There are no council disruption records for this workspace.</p></div>}
        </section>
      </div>
    </>
  );
}
