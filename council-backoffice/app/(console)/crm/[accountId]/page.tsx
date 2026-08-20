import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ExternalLink, Mail, MessageSquareText, UserRoundPlus } from "lucide-react";

import {
  changeCrmAccountStageAction,
  changeCrmTaskStatusAction,
  saveCrmActivityAction,
  saveCrmContactAction,
  saveCrmTaskAction,
} from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalQueue } from "@/components/operational-queue";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requirePlatformAdminSession } from "@/lib/auth";
import {
  getCrmAccountOverview,
  listCrmAccountMessagesPage,
  listCrmActivitiesPage,
  listCrmContactsPage,
  listCrmTasksPage,
} from "@/lib/crm";
import { formatDateTime, humanise } from "@/lib/format";
import { operationalQueueStateFromServerPage, type OperationalQueueSearchParams } from "@/lib/operational-queue";
import { crmStages } from "@/lib/types";
import { assertUuid } from "@/lib/validation";

type CrmAccountView = "activities" | "contacts" | "messages" | "tasks";
type PageParams = OperationalQueueSearchParams & { error?: string; saved?: string; view?: string };

const views: CrmAccountView[] = ["contacts", "messages", "activities", "tasks"];
const contactChannels = ["email", "phone", "linkedin", "meeting", "none"] as const;
const activityKinds = ["email", "call", "meeting", "note", "proposal", "demo", "task-update"] as const;
const activityDirections = ["outbound", "inbound", "internal"] as const;
const taskPriorities = ["low", "normal", "high", "urgent"] as const;
const taskStatuses = ["open", "in-progress", "completed", "cancelled"] as const;
const messageChannels = ["email", "phone", "sms", "linkedin", "meeting", "note"] as const;
const messageStatuses = ["draft", "sent", "delivered", "received", "read", "failed"] as const;

function inputDateTime() {
  const value = new Date();
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function defaultRetentionDate() {
  const value = new Date();
  value.setUTCFullYear(value.getUTCFullYear() + 2);
  return value.toISOString().slice(0, 10);
}

function viewFrom(value?: string): CrmAccountView {
  return views.includes(value as CrmAccountView) ? value as CrmAccountView : "contacts";
}

function ContactComposer({ accountId }: { accountId: string }) {
  return (
    <OperationalDrawer description="Use professional details only and document where the contact came from." title="Add Professional Contact" triggerLabel="Add Contact" triggerStyle="primary" wide>
      <form action={saveCrmContactAction} className="stack-form">
        <input name="accountId" type="hidden" value={accountId} />
        <div className="field-grid">
          <div className="field"><label htmlFor="fullName">Full name</label><input id="fullName" maxLength={160} name="fullName" required /></div>
          <div className="field"><label htmlFor="jobTitle">Job title</label><input id="jobTitle" maxLength={160} name="jobTitle" /></div>
          <div className="field"><label htmlFor="professionalEmail">Work email</label><input id="professionalEmail" name="professionalEmail" type="email" /></div>
          <div className="field"><label htmlFor="professionalPhone">Work phone</label><input id="professionalPhone" maxLength={40} name="professionalPhone" type="tel" /></div>
          <div className="field"><label htmlFor="linkedinUrl">LinkedIn profile</label><input id="linkedinUrl" name="linkedinUrl" type="url" /></div>
          <div className="field"><label htmlFor="preferredChannel">Preferred channel</label><select id="preferredChannel" name="preferredChannel">{contactChannels.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
          <div className="field"><label htmlFor="lawfulBasis">Lawful basis</label><select defaultValue="legitimate-interests" id="lawfulBasis" name="lawfulBasis">{["legitimate-interests", "consent", "contract", "public-task"].map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
          <div className="field"><label htmlFor="retentionReviewAt">Retention review</label><input defaultValue={defaultRetentionDate()} id="retentionReviewAt" name="retentionReviewAt" required type="date" /></div>
          <div className="field field-span"><label htmlFor="source">Contact source</label><input id="source" maxLength={200} name="source" placeholder="Council website, conference introduction, referral…" required /></div>
          <label className="check-option field-span"><input name="doNotContact" type="checkbox" /> Do not contact / suppression requested</label>
        </div>
        <button className="primary-button" type="submit">Save Professional Contact</button>
      </form>
    </OperationalDrawer>
  );
}

function ActivityComposer({ accountId, contacts }: { accountId: string; contacts: Array<{ doNotContact: boolean; fullName: string; id: string }> }) {
  return (
    <OperationalDrawer description="Summarise the business outcome and next step. Do not paste resident records or special-category personal data." title="Record Relationship Outcome" triggerLabel="Record Outcome" triggerStyle="primary" wide>
      <form action={saveCrmActivityAction} className="stack-form">
        <input name="accountId" type="hidden" value={accountId} />
        <div className="field-grid">
          <div className="field"><label htmlFor="kind">Type</label><select id="kind" name="kind">{activityKinds.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
          <div className="field"><label htmlFor="direction">Direction</label><select defaultValue="outbound" id="direction" name="direction">{activityDirections.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
          <div className="field field-span"><label htmlFor="contactId">Contact</label><select id="contactId" name="contactId"><option value="">Organisation-level / internal note</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName}{contact.doNotContact ? " — DO NOT CONTACT" : ""}</option>)}</select></div>
          <div className="field field-span"><label htmlFor="subject">Subject</label><input id="subject" maxLength={180} name="subject" required /></div>
          <div className="field field-span"><label htmlFor="summary">Outcome summary</label><textarea id="summary" maxLength={3000} name="summary" required /></div>
          <div className="field"><label htmlFor="occurredAt">Occurred</label><input defaultValue={inputDateTime()} id="occurredAt" name="occurredAt" required type="datetime-local" /></div>
          <div className="field"><label htmlFor="nextFollowUpAt">Next follow-up</label><input id="nextFollowUpAt" name="nextFollowUpAt" type="datetime-local" /></div>
          <div className="field field-span"><label htmlFor="nextStep">Next step</label><input id="nextStep" maxLength={500} name="nextStep" /></div>
        </div>
        <button className="primary-button" type="submit">Record Relationship Note</button>
      </form>
    </OperationalDrawer>
  );
}

function TaskComposer({ accountId, contacts }: { accountId: string; contacts: Array<{ fullName: string; id: string }> }) {
  return (
    <OperationalDrawer title="Add Follow-Up" triggerLabel="Add Follow-Up" triggerStyle="primary">
      <form action={saveCrmTaskAction} className="stack-form">
        <input name="accountId" type="hidden" value={accountId} />
        <div className="field"><label htmlFor="taskTitle">Action</label><input id="taskTitle" maxLength={200} name="title" required /></div>
        <div className="field-grid">
          <div className="field"><label htmlFor="taskContactId">Contact</label><select id="taskContactId" name="contactId"><option value="">Organisation-level</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName}</option>)}</select></div>
          <div className="field"><label htmlFor="priority">Priority</label><select defaultValue="normal" id="priority" name="priority">{taskPriorities.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
          <div className="field field-span"><label htmlFor="dueAt">Due</label><input id="dueAt" name="dueAt" type="datetime-local" /></div>
        </div>
        <button className="primary-button" type="submit">Add Follow-Up</button>
      </form>
    </OperationalDrawer>
  );
}

export default async function CrmAccountPage({ params, searchParams }: { params: Promise<{ accountId: string }>; searchParams: Promise<PageParams> }) {
  await requirePlatformAdminSession();
  const [route, query] = await Promise.all([params, searchParams]);
  let accountId: string;
  try {
    accountId = assertUuid(route.accountId);
  } catch {
    notFound();
  }

  const view = viewFrom(query.view);
  const [overview, serverPage] = await Promise.all([
    getCrmAccountOverview(accountId),
    view === "messages"
      ? listCrmAccountMessagesPage(accountId, query)
      : view === "activities"
        ? listCrmActivitiesPage(accountId, query)
        : view === "tasks"
          ? listCrmTasksPage(accountId, query)
          : listCrmContactsPage(accountId, query),
  ]);
  if (!overview) notFound();
  const { account, contactOptions, recordCounts } = overview;
  const pathname = `/crm/${account.id}`;

  return (
    <>
      <PageHeader eyebrow={`${humanise(account.accountType)} relationship`} title={account.name} description={account.summary ?? "Track professional contacts, conversations, opportunity stage and next actions for this relationship."} action={<Link className="secondary-button" href="/crm"><ArrowLeft aria-hidden="true" size={16} /> All Relationships</Link>} />
      <FeedbackBanner error={query.error} saved={query.saved} />

      <section aria-label="Relationship overview" className="overview-grid space-bottom-lg">
        <article className="panel">
          <div className="panel-heading"><h2>Relationship Status</h2><StatusPill status={account.stage} /></div>
          <div className="connection-list">
            <div className="connection-row"><span>Last contact</span><strong>{formatDateTime(account.lastContactAt)}</strong></div>
            <div className="connection-row"><span>Next follow-up</span><strong>{formatDateTime(account.nextFollowUpAt)}</strong></div>
            <div className="connection-row"><span>Open tasks</span><strong>{account.openTaskCount}</strong></div>
            <div className="connection-row"><span>Overdue tasks</span><strong>{account.overdueTaskCount}</strong></div>
            {account.websiteUrl ? <div className="connection-row"><span>Organisation website</span><a href={account.websiteUrl} rel="noreferrer" target="_blank">Open <ExternalLink aria-hidden="true" size={14} /></a></div> : null}
          </div>
        </article>
        <aside className="panel form-panel">
          <h2>Pipeline Control</h2>
          <p className="form-intro">Stage changes are written to the immutable CRM audit trail.</p>
          <form action={changeCrmAccountStageAction} className="stack-form">
            <input name="accountId" type="hidden" value={account.id} />
            <div className="field"><label htmlFor="stage">Current stage</label><select defaultValue={account.stage} id="stage" name="stage">{crmStages.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
            <button className="primary-button" type="submit">Update Stage</button>
          </form>
        </aside>
      </section>

      <nav aria-label="Relationship record views" className="queue-view-tabs">
        <Link aria-current={view === "contacts" ? "page" : undefined} href={`${pathname}?view=contacts`}>Contacts ({recordCounts.contacts})</Link>
        <Link aria-current={view === "messages" ? "page" : undefined} href={`${pathname}?view=messages`}>Messages ({recordCounts.messages})</Link>
        <Link aria-current={view === "activities" ? "page" : undefined} href={`${pathname}?view=activities`}>Outcomes ({recordCounts.activities})</Link>
        <Link aria-current={view === "tasks" ? "page" : undefined} href={`${pathname}?view=tasks`}>Follow-Ups ({recordCounts.tasks})</Link>
      </nav>

      {view === "contacts" ? (() => {
        const queue = operationalQueueStateFromServerPage(serverPage as Awaited<ReturnType<typeof listCrmContactsPage>>);
        return <OperationalQueue action={<ContactComposer accountId={account.id} />} caption={`Professional contacts recorded for ${account.name}, including route, governance basis, suppression and retention-review state.`} columns={[{ label: "Contact", sortKey: "name" }, { label: "Professional Route" }, { label: "Governance" }, { label: "Retention Review", sortKey: "review" }, { label: "Status" }, { label: "Actions" }]} emptyState={<div className="empty-state"><UserRoundPlus aria-hidden="true" size={30} /><h2>No Matching Contacts</h2><p>Add a real professional contact before recording directed outreach, or reset this view.</p></div>} filterLabel="channels" filterOptions={contactChannels.map((value) => ({ label: humanise(value), value }))} fixedParams={{ view: "contacts" }} pathname={pathname} searchLabel="Search name, role, contact route or source" state={queue} statusOptions={[{ label: "Active", value: "active" }, { label: "Suppressed", value: "suppressed" }]} title="Professional Contacts" viewKey="crm-account-contacts">
          {queue.items.map((contact) => <tr key={contact.id}>
            <td className="queue-primary-cell" data-label="Contact"><strong>{contact.fullName}</strong><small>{contact.jobTitle ?? "Role not recorded"}</small></td>
            <td data-label="Professional Route">{contact.professionalEmail ? <a href={`mailto:${contact.professionalEmail}`}>{contact.professionalEmail}</a> : "No work email"}<small>{contact.professionalPhone ? <a href={`tel:${contact.professionalPhone}`}>{contact.professionalPhone}</a> : `Preferred: ${humanise(contact.preferredChannel)}`}</small></td>
            <td data-label="Governance">{humanise(contact.lawfulBasis)}<small>Source: {contact.source}</small></td>
            <td data-label="Retention Review">{contact.retentionReviewAt}</td>
            <td data-label="Status"><StatusPill status={contact.doNotContact ? "suppressed" : "active"} /></td>
            <td className="queue-cell-actions" data-label="Actions"><OperationalDrawer title={contact.fullName} triggerLabel="Review" triggerStyle="text"><div className="queue-record-detail"><StatusPill status={contact.doNotContact ? "suppressed" : "active"} /><dl className="queue-detail-list"><div><dt>Role</dt><dd>{contact.jobTitle ?? "Not recorded"}</dd></div><div><dt>Work email</dt><dd>{contact.professionalEmail ?? "Not recorded"}</dd></div><div><dt>Work phone</dt><dd>{contact.professionalPhone ?? "Not recorded"}</dd></div><div><dt>LinkedIn</dt><dd>{contact.linkedinUrl ? <a href={contact.linkedinUrl} rel="noreferrer" target="_blank">Open Profile</a> : "Not recorded"}</dd></div><div><dt>Preferred channel</dt><dd>{humanise(contact.preferredChannel)}</dd></div><div><dt>Lawful basis</dt><dd>{humanise(contact.lawfulBasis)}</dd></div><div><dt>Source</dt><dd>{contact.source}</dd></div><div><dt>Retention review</dt><dd>{contact.retentionReviewAt}</dd></div></dl></div></OperationalDrawer></td>
          </tr>)}
        </OperationalQueue>;
      })() : null}

      {view === "messages" ? (() => {
        const queue = operationalQueueStateFromServerPage(serverPage as Awaited<ReturnType<typeof listCrmAccountMessagesPage>>);
        return <OperationalQueue caption={`Sent, received and internal correspondence recorded for ${account.name}, with complete server-side paging across ${recordCounts.messages} records.`} columns={[{ label: "Message", sortKey: "subject" }, { label: "Contact", sortKey: "contact" }, { label: "Channel" }, { label: "Occurred", sortKey: "occurred" }, { label: "Status", sortKey: "status" }, { label: "Actions" }]} emptyState={<div className="empty-state"><Mail aria-hidden="true" size={30} /><h2>No Matching Correspondence</h2><p>Recorded sent, received and internal messages appear here without a six-record display cap.</p></div>} filterLabel="channels" filterOptions={messageChannels.map((value) => ({ label: humanise(value), value }))} fixedParams={{ view: "messages" }} pathname={pathname} searchLabel="Search subject, body, contact or recipient" state={queue} statusOptions={messageStatuses.map((value) => ({ label: humanise(value), value }))} title="Correspondence" viewKey="crm-account-messages">
          {queue.items.map((message) => <tr key={message.id}>
            <td className="queue-primary-cell" data-label="Message"><strong>{message.subject}</strong><small>{humanise(message.direction)}</small></td><td data-label="Contact">{message.contactName ?? "Organisation-level"}</td><td data-label="Channel">{humanise(message.channel)}</td><td data-label="Occurred">{formatDateTime(message.occurredAt)}</td><td data-label="Status"><StatusPill status={message.deliveryStatus} /></td>
            <td className="queue-cell-actions" data-label="Actions"><OperationalDrawer title={message.subject} triggerLabel="Review" triggerStyle="text" wide><div className="queue-record-detail"><StatusPill status={message.deliveryStatus} /><dl className="queue-detail-list"><div><dt>Direction</dt><dd>{humanise(message.direction)}</dd></div><div><dt>Channel</dt><dd>{humanise(message.channel)}</dd></div><div><dt>Contact</dt><dd>{message.contactName ?? "Organisation-level"}</dd></div><div><dt>Occurred</dt><dd>{formatDateTime(message.occurredAt)}</dd></div><div><dt>Recipients</dt><dd>{message.recipientAddresses.join(", ") || "None recorded"}</dd></div><div><dt>Attachments</dt><dd>{message.attachmentNames.join(", ") || "None recorded"}</dd></div></dl><div className="truth-note"><strong>Message body</strong><p>{message.body}</p></div></div></OperationalDrawer></td>
          </tr>)}
        </OperationalQueue>;
      })() : null}

      {view === "activities" ? (() => {
        const queue = operationalQueueStateFromServerPage(serverPage as Awaited<ReturnType<typeof listCrmActivitiesPage>>);
        return <OperationalQueue action={<ActivityComposer accountId={account.id} contacts={contactOptions} />} caption={`Calls, meetings and relationship outcomes for ${account.name}, including direction, occurrence and evidenced next steps.`} columns={[{ label: "Outcome", sortKey: "subject" }, { label: "Type" }, { label: "Contact" }, { label: "Occurred", sortKey: "occurred" }, { label: "Next Step", sortKey: "follow-up" }, { label: "Actions" }]} emptyState={<div className="empty-state"><MessageSquareText aria-hidden="true" size={30} /><h2>No Matching Outcomes</h2><p>Calls, meetings, proposals and commercial outcomes appear here in date order.</p></div>} filterLabel="outcome types" filterOptions={activityKinds.map((value) => ({ label: humanise(value), value }))} fixedParams={{ view: "activities" }} pathname={pathname} searchLabel="Search subject, summary, contact or next step" state={queue} statusOptions={activityDirections.map((value) => ({ label: humanise(value), value }))} title="Relationship Outcomes" viewKey="crm-account-activities">
          {queue.items.map((activity) => <tr key={activity.id}>
            <td className="queue-primary-cell" data-label="Outcome"><strong>{activity.subject}</strong><small>{humanise(activity.direction)}</small></td><td data-label="Type">{humanise(activity.kind)}</td><td data-label="Contact">{activity.contactName ?? "Organisation-level"}</td><td data-label="Occurred">{formatDateTime(activity.occurredAt)}</td><td data-label="Next Step">{activity.nextStep ?? "Not recorded"}<small>{activity.nextFollowUpAt ? formatDateTime(activity.nextFollowUpAt) : "No follow-up scheduled"}</small></td>
            <td className="queue-cell-actions" data-label="Actions"><OperationalDrawer title={activity.subject} triggerLabel="Review" triggerStyle="text"><div className="queue-record-detail"><StatusPill status={activity.direction} /><p>{activity.summary}</p><dl className="queue-detail-list"><div><dt>Type</dt><dd>{humanise(activity.kind)}</dd></div><div><dt>Contact</dt><dd>{activity.contactName ?? "Organisation-level"}</dd></div><div><dt>Occurred</dt><dd>{formatDateTime(activity.occurredAt)}</dd></div><div><dt>Next step</dt><dd>{activity.nextStep ?? "Not recorded"}</dd></div><div><dt>Next follow-up</dt><dd>{formatDateTime(activity.nextFollowUpAt)}</dd></div></dl></div></OperationalDrawer></td>
          </tr>)}
        </OperationalQueue>;
      })() : null}

      {view === "tasks" ? (() => {
        const queue = operationalQueueStateFromServerPage(serverPage as Awaited<ReturnType<typeof listCrmTasksPage>>);
        return <OperationalQueue action={<TaskComposer accountId={account.id} contacts={contactOptions} />} caption={`Follow-up workload for ${account.name}, including contact, due date, priority and operational state.`} columns={[{ label: "Task" }, { label: "Contact" }, { label: "Due", sortKey: "due" }, { label: "Priority", sortKey: "priority" }, { label: "Status", sortKey: "status" }, { label: "Actions" }]} emptyState={<div className="empty-state"><CalendarClock aria-hidden="true" size={30} /><h2>No Matching Follow-Ups</h2><p>Create the next action so council and partner conversations do not go cold.</p></div>} filterLabel="priorities" filterOptions={taskPriorities.map((value) => ({ label: humanise(value), value }))} fixedParams={{ view: "tasks" }} pathname={pathname} searchLabel="Search task, contact or assignee" state={queue} statusOptions={taskStatuses.map((value) => ({ label: humanise(value), value }))} title="Follow-Up Tasks" viewKey="crm-account-tasks">
          {queue.items.map((task) => <tr key={task.id}>
            <td className="queue-primary-cell" data-label="Task"><strong>{task.title}</strong><small>{task.assignedTo ? `Assigned ${task.assignedTo}` : "No assignee recorded"}</small></td><td data-label="Contact">{task.contactName ?? "Organisation-level"}</td><td data-label="Due">{formatDateTime(task.dueAt)}</td><td data-label="Priority">{humanise(task.priority)}</td><td data-label="Status"><StatusPill status={task.status} /></td>
            <td className="queue-cell-actions" data-label="Actions"><OperationalDrawer title={task.title} triggerLabel="Review" triggerStyle="text"><div className="queue-record-detail"><StatusPill status={task.status} /><dl className="queue-detail-list"><div><dt>Contact</dt><dd>{task.contactName ?? "Organisation-level"}</dd></div><div><dt>Due</dt><dd>{formatDateTime(task.dueAt)}</dd></div><div><dt>Priority</dt><dd>{humanise(task.priority)}</dd></div><div><dt>Assigned</dt><dd>{task.assignedTo ?? "Not assigned"}</dd></div><div><dt>Completed</dt><dd>{formatDateTime(task.completedAt)}</dd></div></dl>{task.status !== "completed" && task.status !== "cancelled" ? <form action={changeCrmTaskStatusAction} className="inline-form queue-record-actions"><input name="accountId" type="hidden" value={account.id} /><input name="taskId" type="hidden" value={task.id} />{task.status === "open" ? <button className="secondary-button button-small" name="status" value="in-progress">Start</button> : null}<button className="primary-button button-small" name="status" value="completed">Complete</button><button className="secondary-button button-small" name="status" value="cancelled">Cancel</button></form> : null}</div></OperationalDrawer></td>
          </tr>)}
        </OperationalQueue>;
      })() : null}

      <div className="truth-note space-top-lg">CRM changes are platform-superadmin only and audited without copying contact details or conversation bodies into the audit log.</div>
    </>
  );
}
