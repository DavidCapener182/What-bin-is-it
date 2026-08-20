import { TriangleAlert } from "lucide-react";

import { changeDisruptionStatusAction, saveDisruptionAction } from "@/app/actions";
import { CouncilMessagePreview } from "@/components/council-message-preview";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalQueue } from "@/components/operational-queue";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import {
  consoleE2eActiveDisruptions,
  consoleE2eBroadcasts,
  consoleE2eDisruptionsPage,
  consoleE2eDisruptionTitles,
  isConsoleE2eFixtureSession,
} from "@/lib/console-e2e-fixtures";
import { listActiveDisruptionContexts, listCouncilBroadcastsForContent, listDisruptionsPage, listDisruptionTitles } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";
import { operationalQueueStateFromServerPage, type OperationalQueueSearchParams } from "@/lib/operational-queue";
import { councilRoleCan } from "@/lib/permissions";

type PageParams = OperationalQueueSearchParams & { error?: string; saved?: string };

const collectionTypes = ["all", "general", "recycling", "garden", "food", "other"] as const;
const causes = ["operational", "weather", "bank-holiday", "industrial-action", "vehicle", "emergency", "other"] as const;
const statuses = ["published", "draft", "resolved", "archived"] as const;

export default async function DisruptionsPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canWrite = councilRoleCan(session.role, "content:write");
  const canPublish = councilRoleCan(session.role, "content:publish");
  const params = await searchParams;
  const fixtureSession = isConsoleE2eFixtureSession(session);
  const [serverPage, activeDisruptions, existingTitles] = fixtureSession
    ? await Promise.all([
        consoleE2eDisruptionsPage(params),
        consoleE2eActiveDisruptions(),
        consoleE2eDisruptionTitles(),
      ])
    : await Promise.all([
        listDisruptionsPage(session, params),
        listActiveDisruptionContexts(session),
        listDisruptionTitles(session),
      ]);
  const items = serverPage.items;
  const broadcasts = fixtureSession
    ? consoleE2eBroadcasts()
    : await listCouncilBroadcastsForContent(session, items.map((item) => item.id));
  const broadcastsByContentId = new Map<string, (typeof broadcasts)[number]>();
  broadcasts.forEach((broadcast) => {
    if (!broadcastsByContentId.has(broadcast.contentId)) broadcastsByContentId.set(broadcast.contentId, broadcast);
  });
  const queue = operationalQueueStateFromServerPage(serverPage);

  const composer = canWrite ? (
    <OperationalDrawer
      description="Use a controlled template for urgent updates. Council and audience confirmation remain mandatory for publishing."
      title="Record Service Disruption"
      triggerLabel="Record Disruption"
      triggerStyle="primary"
      wide
    >
      <section className="panel form-panel">
        <p className="form-intro">Use precise resident instructions and an official source whenever possible.</p>
        <form action={saveDisruptionAction} className="stack-form" id="disruption-compose">
          <input name="expectedOrganisationId" type="hidden" value={session.organisation.id} />
          <div className="field"><label htmlFor="disruption-title">Title</label><input autoComplete="off" id="disruption-title" maxLength={120} name="title" required /></div>
          <div className="field"><label htmlFor="detail">What happened?</label><textarea id="detail" maxLength={600} name="detail" required /></div>
          <fieldset><legend>Affected collection types</legend><div className="check-grid">{collectionTypes.map((type) => <label className="check-option" key={type}><input defaultChecked={type === "all"} name="collectionTypes" type="checkbox" value={type} />{humanise(type)}</label>)}</div></fieldset>
          <div className="field"><label htmlFor="areaLabels">Affected areas, one per line</label><textarea id="areaLabels" name="areaLabels" /></div>
          <fieldset><legend>Notification audience</legend><div className="check-grid"><label className="check-option"><input defaultChecked name="audienceScope" type="radio" value="council" />All opted-in residents</label><label className="check-option"><input name="audienceScope" type="radio" value="targeted" />Only matching residents</label></div></fieldset>
          <fieldset><legend>Target collection types</legend><div className="check-grid">{collectionTypes.filter((type) => type !== "all").map((type) => <label className="check-option" key={type}><input name="audienceCollectionTypes" type="checkbox" value={type} />{humanise(type)}</label>)}</div></fieldset>
          <div className="field"><label htmlFor="audienceCollectionDates">Target collection dates, one per line</label><textarea id="audienceCollectionDates" name="audienceCollectionDates" placeholder="2026-08-03…" /></div>
          <div className="field"><label htmlFor="audienceLabels">Approved round or ward labels, one per line</label><textarea id="audienceLabels" name="audienceLabels" /><span className="help-text">Labels match only when the council feed registers the same non-address operational label.</span></div>
          <div className="field"><label htmlFor="cause">Cause</label><select id="cause" name="cause">{causes.map((cause) => <option key={cause} value={cause}>{humanise(cause)}</option>)}</select></div>
          <div className="field"><label htmlFor="residentInstruction">What should residents do?</label><textarea id="residentInstruction" maxLength={400} name="residentInstruction" required /></div>
          <div className="field-grid"><div className="field"><label htmlFor="disruption-starts">Starts</label><input id="disruption-starts" name="startsAt" required type="datetime-local" /></div><div className="field"><label htmlFor="expectedResumeAt">Expected resume</label><input id="expectedResumeAt" name="expectedResumeAt" type="datetime-local" /></div><div className="field"><label htmlFor="disruption-ends">Ends</label><input id="disruption-ends" name="endsAt" type="datetime-local" /></div><div className="field"><label htmlFor="disruption-source">Official source</label><input autoComplete="off" id="disruption-source" name="sourceUrl" type="url" /></div></div>
          {canPublish ? <label className="check-option"><input name="sendPush" type="checkbox" value="yes" />Also send a push alert to the selected opted-in audience</label> : null}
          {canPublish ? <label className="check-option"><input name="confirmAudience" type="checkbox" value="yes" />I reviewed the audience and message preview</label> : null}
          {canPublish ? <label className="council-action-confirmation"><input name="confirmCouncilAction" type="checkbox" value="yes" /><span><strong>Confirm {session.organisation.name}</strong><small>Required when publishing this disruption to residents. Drafts do not need confirmation.</small></span></label> : null}
          <div className="form-actions"><button className="secondary-button" name="status" value="draft">Save Draft</button>{canPublish ? <button className="primary-button" name="status" value="published">Publish Alert</button> : null}</div>
        </form>
        <CouncilMessagePreview activeDisruptions={activeDisruptions} councilName={session.organisation.name} existingTitles={existingTitles} formId="disruption-compose" mode="disruption" />
      </section>
    </OperationalDrawer>
  ) : undefined;

  return (
    <>
      <PageHeader eyebrow="Operational alerts" title="Service Disruptions" description="Triage live incidents, drafts and resolved updates without keeping a long authoring form open beside the queue." />
      <FeedbackBanner error={params.error} saved={params.saved} />
      <OperationalQueue
        action={composer}
        caption={`Service disruption records for ${session.organisation.name}, with affected services, lifecycle and push-delivery evidence.`}
        columns={[
          { label: "Disruption", sortKey: "title" },
          { label: "Affected Service" },
          { label: "Timeline", sortKey: "starts" },
          { label: "Status", sortKey: "status" },
          { label: "Push Delivery" },
          { label: "Actions" },
        ]}
        emptyState={<div className="empty-state"><TriangleAlert aria-hidden="true" size={32} /><h2>No Matching Disruptions</h2><p>There are no council disruption records in this view.</p></div>}
        filterLabel="causes"
        filterOptions={causes.map((value) => ({ label: humanise(value), value }))}
        pathname="/disruptions"
        searchLabel="Search title, instruction, area or collection type"
        state={queue}
        statusOptions={statuses.map((value) => ({ label: humanise(value), value }))}
        title="Disruption Queue"
        viewKey="disruptions"
      >
        {queue.items.map((item) => {
          const broadcast = broadcastsByContentId.get(item.id);
          return (
            <tr key={item.id}>
              <td className="queue-primary-cell" data-label="Disruption"><strong>{item.title}</strong><small>{item.residentInstruction}</small></td>
              <td data-label="Affected Service">{item.collectionTypes.map(humanise).join(", ")}<small>{item.areaLabels.length ? item.areaLabels.join(", ") : "Council-wide areas"} · {humanise(item.cause)}</small></td>
              <td data-label="Timeline">{formatDateTime(item.startsAt)}<small>Expected resume {formatDateTime(item.expectedResumeAt)} · ends {formatDateTime(item.endsAt)}</small></td>
              <td data-label="Status"><StatusPill status={item.status} /></td>
              <td data-label="Push Delivery">{broadcast ? <><strong>{humanise(broadcast.status)}</strong><small>{broadcast.acceptedCount} accepted · {broadcast.failedCount} failed</small></> : "No push job"}</td>
              <td className="queue-cell-actions" data-label="Actions">
                <OperationalDrawer title={item.title} triggerLabel="Review" triggerStyle="text">
                  <div className="queue-record-detail">
                    <StatusPill status={item.status} />
                    <p>{item.detail}</p>
                    <div className="truth-note"><strong>Resident instruction:</strong> {item.residentInstruction}</div>
                    <dl className="queue-detail-list">
                      <div><dt>Cause</dt><dd>{humanise(item.cause)}</dd></div>
                      <div><dt>Collections</dt><dd>{item.collectionTypes.map(humanise).join(", ")}</dd></div>
                      <div><dt>Areas</dt><dd>{item.areaLabels.length ? item.areaLabels.join(", ") : "No narrower area labels"}</dd></div>
                      <div><dt>Started</dt><dd>{formatDateTime(item.startsAt)}</dd></div>
                      <div><dt>Expected resume</dt><dd>{formatDateTime(item.expectedResumeAt)}</dd></div>
                      <div><dt>Official source</dt><dd>{item.sourceUrl ? <a href={item.sourceUrl} rel="noreferrer" target="_blank">Open Source</a> : "Not supplied"}</dd></div>
                    </dl>
                    {canPublish && item.status !== "archived" ? (
                      <form action={changeDisruptionStatusAction} className="stack-form queue-record-actions">
                        <input name="expectedOrganisationId" type="hidden" value={session.organisation.id} />
                        <input name="id" type="hidden" value={item.id} />
                        {item.status === "draft" ? <label className="check-option"><input name="sendPush" type="checkbox" value="yes" />Push alert</label> : null}
                        {item.status === "draft" ? <label className="check-option"><input name="confirmAudience" type="checkbox" value="yes" />Audience checked</label> : null}
                        {item.status === "draft" ? <label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" type="checkbox" value="yes" /><span><strong>Publish for {session.organisation.name}</strong><small>Confirm this is the intended council workspace.</small></span></label> : null}
                        <div className="inline-form">{item.status === "draft" ? <button className="primary-button button-small" name="status" value="published">Publish</button> : null}{item.status === "published" ? <button className="secondary-button button-small" name="status" value="resolved">Resolve</button> : null}<button className="secondary-button button-small" name="status" value="archived">Archive</button></div>
                      </form>
                    ) : null}
                  </div>
                </OperationalDrawer>
              </td>
            </tr>
          );
        })}
      </OperationalQueue>
    </>
  );
}
