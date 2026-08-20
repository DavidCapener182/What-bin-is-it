import { MessageSquarePlus } from "lucide-react";

import { changeAnnouncementStatusAction, saveAnnouncementAction } from "@/app/actions";
import { CouncilMessagePreview } from "@/components/council-message-preview";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalQueue } from "@/components/operational-queue";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import {
  consoleE2eActiveDisruptions,
  consoleE2eAnnouncementsPage,
  consoleE2eAnnouncementTitles,
  consoleE2eBroadcasts,
  isConsoleE2eFixtureSession,
} from "@/lib/console-e2e-fixtures";
import { listActiveDisruptionContexts, listAnnouncementsPage, listAnnouncementTitles, listCouncilBroadcastsForContent } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";
import { operationalQueueStateFromServerPage, type OperationalQueueSearchParams } from "@/lib/operational-queue";
import { councilRoleCan } from "@/lib/permissions";

type PageParams = OperationalQueueSearchParams & { error?: string; saved?: string };

const announcementKinds = ["service", "education", "emergency", "seasonal"] as const;
const announcementStatuses = ["published", "scheduled", "draft", "archived"] as const;

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canWrite = councilRoleCan(session.role, "content:write");
  const canPublish = councilRoleCan(session.role, "content:publish");
  const params = await searchParams;
  const fixtureSession = isConsoleE2eFixtureSession(session);
  const [serverPage, activeDisruptions, existingTitles] = fixtureSession
    ? await Promise.all([
        consoleE2eAnnouncementsPage(params),
        consoleE2eActiveDisruptions(),
        consoleE2eAnnouncementTitles(),
      ])
    : await Promise.all([
        listAnnouncementsPage(session, params),
        listActiveDisruptionContexts(session),
        listAnnouncementTitles(session),
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
      description="Draft, preview and publish a council-scoped resident message. Critical publishing still requires the existing audience and council confirmations."
      title="Create Announcement"
      triggerLabel="Create Announcement"
      triggerStyle="primary"
      wide
    >
      <section className="panel form-panel">
        <p className="form-intro">Council services stay first. Every message records who created or published it.</p>
        <form action={saveAnnouncementAction} className="stack-form" id="announcement-compose">
          <input name="expectedOrganisationId" type="hidden" value={session.organisation.id} />
          <div className="field-grid">
            <div className="field"><label htmlFor="kind">Type</label><select id="kind" name="kind">{announcementKinds.map((kind) => <option key={kind} value={kind}>{humanise(kind)}</option>)}</select></div>
            <div className="field"><label htmlFor="severity">Severity</label><select id="severity" name="severity"><option value="information">Information</option><option value="advice">Advice</option><option value="warning">Warning</option><option value="critical">Critical</option></select></div>
            <div className="field field-span"><label htmlFor="title">Resident-facing title</label><input autoComplete="off" id="title" maxLength={120} name="title" required /></div>
            <div className="field field-span"><label htmlFor="body">Message</label><textarea id="body" maxLength={600} name="body" required /></div>
            <fieldset className="field field-span"><legend>Resident surfaces</legend><div className="check-grid">{["home", "schedule", "guide", "activity"].map((placement) => <label className="check-option" key={placement}><input defaultChecked={placement === "home" || placement === "activity"} name="placements" type="checkbox" value={placement} />{placement === "home" ? "Today" : humanise(placement)}</label>)}</div></fieldset>
            <fieldset className="field field-span"><legend>Audience</legend><div className="check-grid"><label className="check-option"><input defaultChecked name="audienceScope" type="radio" value="council" />All opted-in residents</label><label className="check-option"><input name="audienceScope" type="radio" value="targeted" />Target matching residents</label></div></fieldset>
            <fieldset className="field field-span"><legend>Target collection types</legend><div className="check-grid">{["general", "recycling", "garden", "food", "other"].map((type) => <label className="check-option" key={type}><input name="audienceCollectionTypes" type="checkbox" value={type} />{humanise(type)}</label>)}</div></fieldset>
            <div className="field"><label htmlFor="audienceCollectionDates">Target collection dates</label><textarea id="audienceCollectionDates" name="audienceCollectionDates" placeholder="2026-08-03…" /><span className="help-text">One date per line. Only matching opted-in devices are counted.</span></div>
            <div className="field"><label htmlFor="audienceLabels">Approved round or ward labels</label><textarea id="audienceLabels" name="audienceLabels" /><span className="help-text">Works only when an approved council feed supplies the same non-address label.</span></div>
            <div className="field"><label htmlFor="startsAt">Starts</label><input id="startsAt" name="startsAt" type="datetime-local" /></div>
            <div className="field"><label htmlFor="endsAt">Ends</label><input id="endsAt" name="endsAt" type="datetime-local" /></div>
            <div className="field field-span"><label htmlFor="sourceUrl">Official source URL</label><input autoComplete="off" id="sourceUrl" name="sourceUrl" placeholder="https://…" type="url" /></div>
          </div>
          {canPublish ? <label className="check-option"><input name="sendPush" type="checkbox" value="yes" />Also send a push alert to the selected opted-in audience</label> : null}
          {canPublish ? <label className="check-option"><input name="confirmAudience" type="checkbox" value="yes" />I reviewed the audience and message preview</label> : null}
          {canPublish ? <label className="council-action-confirmation"><input name="confirmCouncilAction" type="checkbox" value="yes" /><span><strong>Confirm {session.organisation.name}</strong><small>Required when publishing this message to residents. Drafts do not need confirmation.</small></span></label> : null}
          <div className="form-actions">
            <button className="secondary-button" name="status" type="submit" value="draft">Save Draft</button>
            {canPublish ? <button className="primary-button" name="status" type="submit" value="published">Publish to App</button> : null}
          </div>
        </form>
        <CouncilMessagePreview
          activeDisruptions={activeDisruptions}
          councilName={session.organisation.name}
          existingTitles={existingTitles}
          formId="announcement-compose"
          mode="announcement"
        />
      </section>
    </OperationalDrawer>
  ) : undefined;

  return (
    <>
      <PageHeader eyebrow="Resident communications" title="Announcements" description="Triage drafts, scheduled messages, live notices and delivery evidence in one council-scoped queue. Open the composer only when authoring is required." />
      <FeedbackBanner error={params.error} saved={params.saved} />
      <OperationalQueue
        action={composer}
        caption={`Announcements for ${session.organisation.name}, including publishing window, status and push-delivery evidence.`}
        columns={[
          { label: "Announcement", sortKey: "title" },
          { label: "Type" },
          { label: "Publishing Window", sortKey: "updated" },
          { label: "Status", sortKey: "status" },
          { label: "Push Delivery" },
          { label: "Actions" },
        ]}
        emptyState={<div className="empty-state"><MessageSquarePlus aria-hidden="true" size={32} /><h2>No Matching Announcements</h2><p>Create the first verified resident message, or reset the current filters.</p></div>}
        filterLabel="types"
        filterOptions={announcementKinds.map((value) => ({ label: humanise(value), value }))}
        pathname="/announcements"
        searchLabel="Search title, message or surface"
        state={queue}
        statusOptions={announcementStatuses.map((value) => ({ label: humanise(value), value }))}
        title="Announcement Queue"
        viewKey="announcements"
      >
        {queue.items.map((item) => {
          const broadcast = broadcastsByContentId.get(item.id);
          return (
            <tr key={item.id}>
              <td className="queue-primary-cell" data-label="Announcement"><strong>{item.title}</strong><small>{item.body}</small></td>
              <td data-label="Type">{humanise(item.kind)}<small>{humanise(item.severity)}</small></td>
              <td data-label="Publishing Window">{formatDateTime(item.startsAt)}<small>Ends {formatDateTime(item.endsAt)} · updated {formatDateTime(item.updatedAt)}</small></td>
              <td data-label="Status"><StatusPill status={item.status} /></td>
              <td data-label="Push Delivery">{broadcast ? <><strong>{humanise(broadcast.status)}</strong><small>{broadcast.acceptedCount} accepted · {broadcast.failedCount} failed · {broadcast.estimatedRecipientCount} estimated</small></> : "No push job"}</td>
              <td className="queue-cell-actions" data-label="Actions">
                <OperationalDrawer title={item.title} triggerLabel="Review" triggerStyle="text">
                  <div className="queue-record-detail">
                    <StatusPill status={item.status} />
                    <p>{item.body}</p>
                    <dl className="queue-detail-list">
                      <div><dt>Type</dt><dd>{humanise(item.kind)} · {humanise(item.severity)}</dd></div>
                      <div><dt>Surfaces</dt><dd>{item.placements.map(humanise).join(", ")}</dd></div>
                      <div><dt>Starts</dt><dd>{formatDateTime(item.startsAt)}</dd></div>
                      <div><dt>Ends</dt><dd>{formatDateTime(item.endsAt)}</dd></div>
                      <div><dt>Official source</dt><dd>{item.sourceUrl ? <a href={item.sourceUrl} rel="noreferrer" target="_blank">Open Source</a> : "Not supplied"}</dd></div>
                    </dl>
                    {broadcast ? <div className="truth-note"><strong>Push reconciliation:</strong> {broadcast.acceptedCount} accepted by notification providers; {broadcast.failedCount} failed or expired from an estimated audience of {broadcast.estimatedRecipientCount}.</div> : null}
                    {canPublish && item.status !== "archived" ? (
                      <form action={changeAnnouncementStatusAction} className="stack-form queue-record-actions">
                        <input name="expectedOrganisationId" type="hidden" value={session.organisation.id} />
                        <input name="id" type="hidden" value={item.id} />
                        {item.status !== "published" ? <label className="check-option"><input name="sendPush" type="checkbox" value="yes" />Push alert</label> : null}
                        {item.status !== "published" ? <label className="check-option"><input name="confirmAudience" type="checkbox" value="yes" />Audience checked</label> : null}
                        {item.status !== "published" ? <label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" type="checkbox" value="yes" /><span><strong>Publish for {session.organisation.name}</strong><small>Confirm this is the intended council workspace.</small></span></label> : null}
                        <div className="inline-form">
                          {item.status !== "published" ? <button className="primary-button button-small" name="status" type="submit" value="published">Publish</button> : null}
                          <button className="secondary-button button-small" name="status" type="submit" value="archived">Archive</button>
                        </div>
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
