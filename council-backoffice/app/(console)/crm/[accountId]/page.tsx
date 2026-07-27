import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Mail,
  MessageSquareText,
  Phone,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";

import {
  changeCrmAccountStageAction,
  changeCrmTaskStatusAction,
  saveCrmActivityAction,
  saveCrmContactAction,
  saveCrmTaskAction,
} from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requirePlatformAdminSession } from "@/lib/auth";
import { getCrmAccountBundle, listCrmMessages } from "@/lib/crm";
import { formatDateTime, humanise } from "@/lib/format";
import { crmStages } from "@/lib/types";
import { assertUuid } from "@/lib/validation";

function inputDateTime(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function defaultRetentionDate() {
  const value = new Date();
  value.setUTCFullYear(value.getUTCFullYear() + 2);
  return value.toISOString().slice(0, 10);
}

export default async function CrmAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requirePlatformAdminSession();
  const route = await params;
  let accountId: string;
  try {
    accountId = assertUuid(route.accountId);
  } catch {
    notFound();
  }
  const [bundle, messages, feedback] = await Promise.all([
    getCrmAccountBundle(accountId),
    listCrmMessages({ accountId }),
    searchParams,
  ]);
  if (!bundle) notFound();
  const { account, contacts, activities, tasks } = bundle;
  const activeTasks = tasks.filter((task) => task.status === "open" || task.status === "in-progress");

  return (
    <>
      <PageHeader
        eyebrow={`${humanise(account.accountType)} relationship`}
        title={account.name}
        description={account.summary ?? "Track professional contacts, conversations, opportunity stage and next actions for this relationship."}
        action={<Link className="secondary-button" href="/crm"><ArrowLeft aria-hidden="true" size={16} /> All relationships</Link>}
      />
      <FeedbackBanner {...feedback} />

      <section className="overview-grid space-bottom-lg">
        <article className="panel">
          <div className="panel-heading"><h2>Relationship status</h2><StatusPill status={account.stage} /></div>
          <div className="connection-list">
            <div className="connection-row"><span>Last contact</span><strong>{formatDateTime(account.lastContactAt)}</strong></div>
            <div className="connection-row"><span>Next follow-up</span><strong>{formatDateTime(account.nextFollowUpAt)}</strong></div>
            <div className="connection-row"><span>Open tasks</span><strong>{activeTasks.length}</strong></div>
            {account.websiteUrl ? <div className="connection-row"><span>Organisation website</span><a href={account.websiteUrl} rel="noreferrer" target="_blank">Open <ExternalLink aria-hidden="true" size={14} /></a></div> : null}
          </div>
        </article>
        <aside className="panel form-panel">
          <h2>Move pipeline stage</h2>
          <p className="form-intro">Stage changes are written to the immutable CRM audit trail.</p>
          <form action={changeCrmAccountStageAction} className="stack-form">
            <input name="accountId" type="hidden" value={account.id} />
            <div className="field"><label htmlFor="stage">Current stage</label><select defaultValue={account.stage} id="stage" name="stage">{crmStages.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
            <button className="primary-button" type="submit">Update stage</button>
          </form>
        </aside>
      </section>

      <section className="crm-section">
        <div className="crm-section-heading">
          <div><span className="eyebrow">People</span><h2>Professional contacts</h2></div>
          <UserRoundPlus aria-hidden="true" color="#007AFF" size={23} />
        </div>
        <div className="overview-grid">
          <article className="panel form-panel">
            <h3>Add contact</h3>
            <p className="form-intro">Use professional details only and document where the contact came from.</p>
            <form action={saveCrmContactAction} className="stack-form">
              <input name="accountId" type="hidden" value={account.id} />
              <div className="field-grid">
                <div className="field"><label htmlFor="fullName">Full name</label><input id="fullName" maxLength={160} name="fullName" required /></div>
                <div className="field"><label htmlFor="jobTitle">Job title</label><input id="jobTitle" maxLength={160} name="jobTitle" /></div>
                <div className="field"><label htmlFor="professionalEmail">Work email</label><input id="professionalEmail" name="professionalEmail" type="email" /></div>
                <div className="field"><label htmlFor="professionalPhone">Work phone</label><input id="professionalPhone" maxLength={40} name="professionalPhone" type="tel" /></div>
                <div className="field"><label htmlFor="linkedinUrl">LinkedIn profile</label><input id="linkedinUrl" name="linkedinUrl" type="url" /></div>
                <div className="field"><label htmlFor="preferredChannel">Preferred channel</label><select id="preferredChannel" name="preferredChannel">{["email", "phone", "linkedin", "meeting", "none"].map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
                <div className="field"><label htmlFor="lawfulBasis">Lawful basis</label><select defaultValue="legitimate-interests" id="lawfulBasis" name="lawfulBasis">{["legitimate-interests", "consent", "contract", "public-task"].map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
                <div className="field"><label htmlFor="retentionReviewAt">Retention review</label><input defaultValue={defaultRetentionDate()} id="retentionReviewAt" name="retentionReviewAt" required type="date" /></div>
                <div className="field field-span"><label htmlFor="source">Contact source</label><input id="source" maxLength={200} name="source" placeholder="Council website, conference introduction, referral…" required /></div>
                <label className="check-option field-span"><input name="doNotContact" type="checkbox" /> Do not contact / suppression requested</label>
              </div>
              <button className="primary-button" type="submit">Save professional contact</button>
            </form>
          </article>
          <div className="data-list">
            {contacts.length ? contacts.map((contact) => (
              <article className="data-card" key={contact.id}>
                <div className="data-card-top">
                  <div><h3>{contact.fullName}</h3><div className="data-meta"><span>{contact.jobTitle ?? "Role not recorded"}</span><span>{humanise(contact.preferredChannel)}</span></div></div>
                  {contact.doNotContact ? <StatusPill status="suppressed" /> : <StatusPill status="active" />}
                </div>
                <div className="contact-links">
                  {contact.professionalEmail ? <a href={`mailto:${contact.professionalEmail}`}><Mail aria-hidden="true" size={15} /> {contact.professionalEmail}</a> : null}
                  {contact.professionalPhone ? <a href={`tel:${contact.professionalPhone}`}><Phone aria-hidden="true" size={15} /> {contact.professionalPhone}</a> : null}
                </div>
                <div className="data-meta space-top-sm">
                  <span>Basis: {humanise(contact.lawfulBasis)}</span>
                  <span>Source: {contact.source}</span>
                  <span>Review: {contact.retentionReviewAt}</span>
                </div>
              </article>
            )) : <div className="empty-state"><UserRoundPlus aria-hidden="true" size={30} /><h3>No contacts yet</h3><p>Add a real professional contact before recording directed outreach.</p></div>}
          </div>
        </div>
      </section>

      <section className="crm-section">
        <div className="crm-section-heading">
          <div><span className="eyebrow">Correspondence</span><h2>Sent and received messages</h2></div>
          <Link className="secondary-button button-small" href="#relationship-notes">Record conversation</Link>
        </div>
        <div className="message-list">
          {messages.length ? messages.slice(0, 6).map((message) => (
            <article className={`message-card message-${message.direction}`} key={message.id}>
              <div className="message-direction-icon">
                <Mail aria-hidden="true" size={20} />
              </div>
              <div className="message-card-content">
                <div className="message-card-top">
                  <div>
                    <span className="message-account">{message.contactName ?? account.name}</span>
                    <h3>{message.subject}</h3>
                  </div>
                  <StatusPill status={message.deliveryStatus} />
                </div>
                <div className="data-meta">
                  <span>{humanise(message.direction)}</span>
                  <span>{humanise(message.channel)}</span>
                  <time dateTime={message.occurredAt}>{formatDateTime(message.occurredAt)}</time>
                </div>
                <p className="message-preview">{message.body}</p>
              </div>
            </article>
          )) : (
            <div className="empty-state compact-empty">
              <Mail aria-hidden="true" size={30} />
              <h3>No correspondence yet</h3>
              <p>Sent and received messages recorded against this relationship will appear here.</p>
              <Link className="primary-button" href="#relationship-notes">Record conversation</Link>
            </div>
          )}
        </div>
      </section>

      <section className="crm-section" id="relationship-notes">
        <div className="crm-section-heading">
          <div><span className="eyebrow">Relationship notes</span><h2>Calls, meetings and outcomes</h2></div>
          <MessageSquareText aria-hidden="true" color="#007AFF" size={23} />
        </div>
        <div className="split-layout">
          <article className="panel form-panel sticky-panel">
            <h3>Record an outcome</h3>
            <p className="form-intro">Summarise the business outcome and next step. Do not paste resident records or special-category personal data.</p>
            <form action={saveCrmActivityAction} className="stack-form">
              <input name="accountId" type="hidden" value={account.id} />
              <div className="field-grid">
                <div className="field"><label htmlFor="kind">Type</label><select id="kind" name="kind">{["email", "call", "meeting", "note", "proposal", "demo", "task-update"].map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
                <div className="field"><label htmlFor="direction">Direction</label><select defaultValue="outbound" id="direction" name="direction">{["outbound", "inbound", "internal"].map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
                <div className="field field-span"><label htmlFor="contactId">Contact</label><select id="contactId" name="contactId"><option value="">Organisation-level / internal note</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName}{contact.doNotContact ? " — DO NOT CONTACT" : ""}</option>)}</select></div>
                <div className="field field-span"><label htmlFor="subject">Subject</label><input id="subject" maxLength={180} name="subject" required /></div>
                <div className="field field-span"><label htmlFor="summary">Outcome summary</label><textarea id="summary" maxLength={3000} name="summary" required /></div>
                <div className="field"><label htmlFor="occurredAt">Occurred</label><input defaultValue={inputDateTime()} id="occurredAt" name="occurredAt" required type="datetime-local" /></div>
                <div className="field"><label htmlFor="nextFollowUpAt">Next follow-up</label><input id="nextFollowUpAt" name="nextFollowUpAt" type="datetime-local" /></div>
                <div className="field field-span"><label htmlFor="nextStep">Next step</label><input id="nextStep" maxLength={500} name="nextStep" /></div>
              </div>
              <button className="primary-button" type="submit">Record relationship note</button>
            </form>
          </article>
          <div className="crm-timeline">
            {activities.length ? activities.map((activity) => (
              <article className="crm-timeline-item" key={activity.id}>
                <span className="crm-timeline-marker" />
                <div className="data-card">
                  <div className="data-card-top">
                    <div><h3>{activity.subject}</h3><div className="data-meta"><span>{humanise(activity.kind)}</span><span>{humanise(activity.direction)}</span>{activity.contactName ? <span>{activity.contactName}</span> : null}</div></div>
                    <time dateTime={activity.occurredAt}>{formatDateTime(activity.occurredAt)}</time>
                  </div>
                  <p>{activity.summary}</p>
                  {activity.nextStep ? <div className="truth-note space-top-sm"><strong>Next:</strong> {activity.nextStep}{activity.nextFollowUpAt ? ` · ${formatDateTime(activity.nextFollowUpAt)}` : ""}</div> : null}
                </div>
              </article>
            )) : <div className="empty-state"><MessageSquareText aria-hidden="true" size={30} /><h3>No relationship notes yet</h3><p>Calls, meetings, proposals and commercial outcomes will appear here in date order.</p></div>}
          </div>
        </div>
      </section>

      <section className="crm-section">
        <div className="crm-section-heading">
          <div><span className="eyebrow">Next actions</span><h2>Follow-up tasks</h2></div>
          <CalendarClock aria-hidden="true" color="#007AFF" size={23} />
        </div>
        <div className="overview-grid">
          <article className="panel form-panel">
            <h3>Create follow-up</h3>
            <form action={saveCrmTaskAction} className="stack-form">
              <input name="accountId" type="hidden" value={account.id} />
              <div className="field"><label htmlFor="taskTitle">Action</label><input id="taskTitle" maxLength={200} name="title" required /></div>
              <div className="field-grid">
                <div className="field"><label htmlFor="taskContactId">Contact</label><select id="taskContactId" name="contactId"><option value="">Organisation-level</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName}</option>)}</select></div>
                <div className="field"><label htmlFor="priority">Priority</label><select defaultValue="normal" id="priority" name="priority">{["low", "normal", "high", "urgent"].map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
                <div className="field field-span"><label htmlFor="dueAt">Due</label><input id="dueAt" name="dueAt" type="datetime-local" /></div>
              </div>
              <button className="primary-button" type="submit">Add follow-up</button>
            </form>
          </article>
          <div className="data-list">
            {tasks.length ? tasks.map((task) => (
              <article className="data-card" key={task.id}>
                <div className="data-card-top">
                  <div><h3>{task.title}</h3><div className="data-meta"><span>{task.contactName ?? "Organisation-level"}</span><span>Due {formatDateTime(task.dueAt)}</span><span>{humanise(task.priority)}</span></div></div>
                  <StatusPill status={task.status} />
                </div>
                {task.status !== "completed" && task.status !== "cancelled" ? <div className="data-card-actions"><form action={changeCrmTaskStatusAction} className="inline-form"><input name="accountId" type="hidden" value={account.id} /><input name="taskId" type="hidden" value={task.id} />{task.status === "open" ? <button className="secondary-button button-small" name="status" value="in-progress">Start</button> : null}<button className="primary-button button-small" name="status" value="completed">Complete</button><button className="secondary-button button-small" name="status" value="cancelled">Cancel</button></form></div> : null}
              </article>
            )) : <div className="empty-state"><CalendarClock aria-hidden="true" size={30} /><h3>No follow-ups yet</h3><p>Create the next action so council and partner conversations do not go cold.</p></div>}
          </div>
        </div>
      </section>

      <div className="truth-note space-top-lg">
        <ShieldCheck aria-hidden="true" size={17} /> CRM changes are platform-superadmin only and audited without copying contact details or conversation bodies into the audit log.
      </div>
    </>
  );
}
