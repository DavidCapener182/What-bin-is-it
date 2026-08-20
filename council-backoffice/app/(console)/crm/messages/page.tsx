import Link from "next/link";
import {
  AlarmClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Inbox,
  MessageCircle,
  NotebookPen,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  addResidentSupportInternalNoteAction,
  changeResidentSupportStatusAction,
  createResidentSupportSavedResponseAction,
  replyToResidentSupportAction,
  updateResidentSupportCaseAction,
} from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { SavedViewControls } from "@/components/saved-view-controls";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import {
  consoleE2eSavedResponses,
  consoleE2eSupportMetrics,
  consoleE2eSupportStaff,
  consoleE2eSupportThread,
  consoleE2eSupportThreadsPage,
  isConsoleE2eFixtureSession,
} from "@/lib/console-e2e-fixtures";
import { formatDateTime, humanise } from "@/lib/format";
import {
  operationalQueueHref,
  operationalQueueSavedQuery,
  operationalQueueStateFromServerPage,
  type OperationalQueueSearchParams,
  type OperationalQueueState,
} from "@/lib/operational-queue";
import {
  listResidentSupportSavedResponses,
  listResidentSupportStaff,
  listResidentSupportThreadsPage,
  residentSupportEscalations,
  residentSupportMetricsForSession,
  residentSupportPriorities,
  residentSupportStatuses,
  residentSupportThread,
  type ResidentSupportStatus,
} from "@/lib/resident-support";

type PageParams = OperationalQueueSearchParams & { error?: string; historyPage?: string; saved?: string; thread?: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowedStatus(value?: string): ResidentSupportStatus | undefined {
  return value && residentSupportStatuses.includes(value as ResidentSupportStatus)
    ? value as ResidentSupportStatus
    : undefined;
}

function threadStatus(status: ResidentSupportStatus) {
  const labels: Record<ResidentSupportStatus, string> = {
    new: "New",
    "in-progress": "In progress",
    "waiting-resident": "Waiting for resident",
    "waiting-operations": "Waiting for operations",
    resolved: "Resolved",
    closed: "Closed",
  };
  return labels[status];
}

function duration(value?: number) {
  if (value === undefined) return "No data yet";
  if (value < 1) return `${Math.max(1, Math.round(value * 60))}m`;
  if (value < 24) return `${value.toFixed(value < 10 ? 1 : 0)}h`;
  return `${(value / 24).toFixed(1)}d`;
}

function localDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function threadHref(state: OperationalQueueState<unknown>, threadId: string, historyPage = 1) {
  const viewHref = operationalQueueHref("/crm/messages", state);
  const params = new URLSearchParams({ thread: threadId });
  if (historyPage > 1) params.set("historyPage", String(historyPage));
  return `${viewHref}${viewHref.includes("?") ? "&" : "?"}${params.toString()}`;
}

export default async function ResidentInboxPage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  const session = await requireCouncilSession("support:view");
  const params = await searchParams;
  const fixtureSession = isConsoleE2eFixtureSession(session);
  const [serverPage, staff, savedResponses, metrics] = fixtureSession
    ? await Promise.all([
        consoleE2eSupportThreadsPage(params),
        consoleE2eSupportStaff(),
        consoleE2eSavedResponses(),
        consoleE2eSupportMetrics(),
      ])
    : await Promise.all([
        listResidentSupportThreadsPage(session, params),
        listResidentSupportStaff(session),
        listResidentSupportSavedResponses(session),
        residentSupportMetricsForSession(session),
      ]);
  const queue = operationalQueueStateFromServerPage(serverPage);
  const threads = queue.items;
  const status = allowedStatus(queue.status);
  const requestedThreadId = typeof params.thread === "string" && uuidPattern.test(params.thread)
    ? params.thread
    : undefined;
  const selectedThreadId = requestedThreadId ?? threads[0]?.id;
  const requestedHistoryPage = Number.parseInt(typeof params.historyPage === "string" ? params.historyPage : "1", 10);
  const selectedThread = selectedThreadId
    ? fixtureSession
      ? await consoleE2eSupportThread(selectedThreadId)
      : await residentSupportThread(session, selectedThreadId, requestedHistoryPage)
    : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Resident services"
        title="Support cases"
        description={session.platformAdmin
          ? "Manage app conversations across every council, with council scope, assignment, SLAs and a complete audited case history."
          : `Manage app conversations linked to ${session.organisation.name}. Other councils' cases remain inaccessible.`}
        action={session.platformAdmin ? <Link className="secondary-button" href="/crm">Relationship CRM</Link> : undefined}
      />
      <FeedbackBanner error={params.error} saved={params.saved} />

      <section aria-label="Resident support outcomes" className="metric-grid support-metric-grid">
        <article className="metric-card tone-blue">
          <span className="metric-label">New cases</span><strong className="metric-value">{metrics.newCount}</strong>
          <span className="metric-detail">Waiting for first triage</span>
        </article>
        <article className="metric-card tone-red">
          <span className="metric-label">Overdue</span><strong className="metric-value">{metrics.overdueCount}</strong>
          <span className="metric-detail">Open cases past their SLA</span>
        </article>
        <article className="metric-card tone-teal">
          <span className="metric-label">Median first reply</span><strong className="metric-value">{duration(metrics.medianFirstResponseHours)}</strong>
          <span className="metric-detail">Measured from real support replies</span>
        </article>
        <article className="metric-card tone-amber">
          <span className="metric-label">Median resolution</span><strong className="metric-value">{duration(metrics.medianResolutionHours)}</strong>
          <span className="metric-detail">{metrics.reopenedCount} reopened case{metrics.reopenedCount === 1 ? "" : "s"}</span>
        </article>
      </section>

      <section className="panel support-theme-panel space-bottom-lg">
        <div><span className="eyebrow">Top themes</span><h2>What residents need help with</h2></div>
        <div className="support-theme-list">
          {metrics.topThemes.length ? metrics.topThemes.map(([theme, count]) => (
            <span className="support-theme-chip" key={theme}>{humanise(theme)} <strong>{count}</strong></span>
          )) : <span className="help-text">Themes appear after real cases are recorded.</span>}
        </div>
      </section>

      <form action="/crm/messages" className="correspondence-filters resident-inbox-filters" method="get">
        <div className="field correspondence-search">
          <label className="sr-only" htmlFor="q">Search resident cases</label>
          <span className="search-field-icon"><Search aria-hidden="true" size={18} /></span>
          <input defaultValue={queue.query} id="q" name="q" placeholder="Search topic, tag, council or case reference" />
        </div>
        <div className="field">
          <label className="sr-only" htmlFor="status">Case status</label>
          <select defaultValue={status ?? ""} id="status" name="status">
            <option value="">All statuses</option>
            {residentSupportStatuses.map((value) => <option key={value} value={value}>{threadStatus(value)}</option>)}
          </select>
        </div>
        <div className="field"><label className="sr-only" htmlFor="priority">Case priority</label><select defaultValue={queue.filter} id="priority" name="filter"><option value="">All priorities</option>{residentSupportPriorities.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
        <div className="field"><label className="sr-only" htmlFor="sort">Sort cases</label><select defaultValue={queue.sort} id="sort" name="sort"><option value="updated">Last updated</option><option value="priority">Priority</option><option value="sla">SLA deadline</option><option value="status">Workflow status</option></select></div>
        <div className="field"><label className="sr-only" htmlFor="direction">Sort direction</label><select defaultValue={queue.direction} id="direction" name="direction"><option value="desc">Descending</option><option value="asc">Ascending</option></select></div>
        <div className="field"><label className="sr-only" htmlFor="perPage">Cases per page</label><select defaultValue={queue.pageSize} id="perPage" name="perPage">{[10, 25, 50].map((size) => <option key={size} value={size}>{size} cases</option>)}</select></div>
        <button className="primary-button" type="submit">Apply Filters</button>
        <Link className="secondary-button" href="/crm/messages">Reset</Link>
      </form>

      <div className="operational-view-bar support-view-bar">
        <p aria-live="polite">{queue.total ? `Showing ${(queue.page - 1) * queue.pageSize + 1}–${Math.min(queue.page * queue.pageSize, queue.total)} of ${queue.total} matching cases` : "No cases match this view"}{queue.total !== queue.unfilteredTotal ? ` · ${queue.unfilteredTotal} total` : ""}</p>
        <SavedViewControls currentQuery={operationalQueueSavedQuery(queue)} pathname="/crm/messages" viewKey="resident-support-cases" />
      </div>

      <div className="resident-inbox-layout">
        <section aria-label="Resident support cases" className="resident-thread-list">
          {threads.length ? threads.map((thread) => {
            const overdue = thread.slaDueAt
              && !["resolved", "closed"].includes(thread.status)
              && new Date(thread.slaDueAt) < new Date();
            return (
              <Link
                className={`resident-thread-card${selectedThread?.id === thread.id ? " resident-thread-selected" : ""}`}
                href={threadHref(queue, thread.id)}
                key={thread.id}
              >
                <div className="resident-thread-icon"><UserRound aria-hidden="true" size={20} /></div>
                <div className="resident-thread-copy">
                  <div className="resident-thread-top"><strong>{thread.subject}</strong><time dateTime={thread.lastMessageAt}>{formatDateTime(thread.lastMessageAt)}</time></div>
                  <span>{thread.residentReference}{thread.councilName ? ` · ${thread.councilName}` : ""}</span>
                  <div className="resident-thread-footer">
                    <StatusPill status={thread.status} />
                    <span>{humanise(thread.priority)}</span>
                    {overdue ? <span className="case-overdue"><AlarmClock aria-hidden="true" size={12} /> Overdue</span> : null}
                    {thread.assignedStaffLabel ? <span>{thread.assignedStaffLabel}</span> : <span>Unassigned</span>}
                  </div>
                </div>
              </Link>
            );
          }) : (
            <div className="empty-state resident-inbox-empty"><Inbox aria-hidden="true" size={34} /><h2>No resident cases</h2><p>Messages sent from Activity or Help and support will appear here.</p></div>
          )}
        </section>

        <section aria-label="Selected resident case" className="panel resident-conversation">
          {selectedThread ? (
            <>
              <div className="resident-conversation-head">
                <div>
                  <span className="eyebrow">{humanise(selectedThread.topic)} · {selectedThread.residentReference}</span>
                  <h2>{selectedThread.subject}</h2>
                  <p>{selectedThread.councilName ?? "No selected council"} · Case {selectedThread.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <StatusPill status={selectedThread.status} />
              </div>

              <form action={updateResidentSupportCaseAction} className="support-case-controls">
                <input name="threadId" type="hidden" value={selectedThread.id} />
                <div className="field"><label htmlFor="caseStatus">Status</label><select defaultValue={selectedThread.status} id="caseStatus" name="status">{residentSupportStatuses.map((value) => <option key={value} value={value}>{threadStatus(value)}</option>)}</select></div>
                <div className="field"><label htmlFor="casePriority">Priority</label><select defaultValue={selectedThread.priority} id="casePriority" name="priority">{residentSupportPriorities.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
                <div className="field"><label htmlFor="caseAssignee">Assigned staff</label><select defaultValue={selectedThread.assignedStaffId ?? ""} id="caseAssignee" name="assignedStaffId"><option value="">Unassigned</option>{staff.map((option) => <option key={option.userId} value={option.userId}>{option.label} · {humanise(option.role)}</option>)}</select></div>
                <div className="field"><label htmlFor="caseSla">SLA deadline</label><input defaultValue={localDateTime(selectedThread.slaDueAt)} id="caseSla" name="slaDueAt" type="datetime-local" /></div>
                <div className="field"><label htmlFor="caseEscalation">Escalation</label><select defaultValue={selectedThread.escalationStatus} id="caseEscalation" name="escalationStatus">{residentSupportEscalations.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
                <div className="field"><label htmlFor="caseTags">Topic tags</label><input defaultValue={selectedThread.topicTags.join(", ")} id="caseTags" name="topicTags" placeholder="missed-bin, access, urgent" /></div>
                <div className="field"><label htmlFor="caseReport">Missed-report tracking ID</label><input defaultValue={selectedThread.linkedReportTrackingId} id="caseReport" name="linkedReportTrackingId" placeholder="Optional UUID" /></div>
                <div className="field"><label htmlFor="caseAnnouncement">Council announcement ID</label><input defaultValue={selectedThread.linkedAnnouncementId} id="caseAnnouncement" name="linkedAnnouncementId" placeholder="Optional UUID" /></div>
                <div className="field support-case-wide"><label htmlFor="caseReopenReason">Reopen reason</label><input defaultValue={selectedThread.reopenReason} id="caseReopenReason" name="reopenReason" placeholder="Required only when reopening a resolved or closed case" /></div>
                <button className="secondary-button support-case-wide" type="submit"><ClipboardList aria-hidden="true" size={17} /> Save case details</button>
              </form>

              {selectedThread.messageHistory && selectedThread.messageHistory.pageCount > 1 ? (
                <nav aria-label="Case message history pages" className="queue-pagination support-history-pagination">
                  {selectedThread.messageHistory.page < selectedThread.messageHistory.pageCount ? <Link className="secondary-button button-small" href={threadHref(queue, selectedThread.id, selectedThread.messageHistory.page + 1)}>Older Messages</Link> : <span />}
                  <span>Message page {selectedThread.messageHistory.page} of {selectedThread.messageHistory.pageCount} · {selectedThread.messageHistory.total} messages</span>
                  {selectedThread.messageHistory.page > 1 ? <Link className="secondary-button button-small" href={threadHref(queue, selectedThread.id, selectedThread.messageHistory.page - 1)}>Newer Messages</Link> : <span />}
                </nav>
              ) : null}

              <div className="resident-message-stack">
                {selectedThread.messages.map((message) => (
                  <article className={`resident-message resident-message-${message.sender}`} key={message.id}>
                    <div className="resident-message-bubble">
                      {message.visibility === "internal" ? <strong className="internal-note-label"><NotebookPen aria-hidden="true" size={14} /> Internal note</strong> : null}
                      <p>{message.body}</p>
                      <span>{message.sender === "resident" ? "Resident" : message.sender === "support" ? "What Bin support" : "Staff only"} · <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time></span>
                    </div>
                  </article>
                ))}
              </div>

              {selectedThread.status !== "closed" ? (
                <div className="resident-reply-area">
                  {savedResponses.length ? (
                    <details className="support-saved-responses">
                      <summary>Use a saved response</summary>
                      <div className="support-saved-response-list">
                        {savedResponses.map((response) => (
                          <form action={replyToResidentSupportAction} key={response.id}>
                            <input name="threadId" type="hidden" value={selectedThread.id} />
                            <input name="body" type="hidden" value={response.body} />
                            <button className="secondary-button" type="submit"><Send aria-hidden="true" size={15} /> {response.title}</button>
                          </form>
                        ))}
                      </div>
                    </details>
                  ) : null}
                  <form action={replyToResidentSupportAction} className="resident-reply-form">
                    <input name="threadId" type="hidden" value={selectedThread.id} />
                    <div className="field"><label htmlFor="residentReply">Reply in the app</label><textarea id="residentReply" maxLength={5_000} name="body" placeholder="Write a clear reply. The resident will see this in Activity." required rows={5} /><span className="help-text">Resident-visible. Keep internal operational discussion in an internal note.</span></div>
                    <button className="primary-button" type="submit"><Send aria-hidden="true" size={17} /> Send reply</button>
                  </form>
                  <form action={addResidentSupportInternalNoteAction} className="resident-note-form">
                    <input name="threadId" type="hidden" value={selectedThread.id} />
                    <div className="field"><label htmlFor="internalNote">Internal note</label><textarea id="internalNote" maxLength={5_000} name="body" placeholder="Visible to authorised council or platform staff only." required rows={3} /></div>
                    <button className="secondary-button" type="submit"><NotebookPen aria-hidden="true" size={17} /> Add internal note</button>
                  </form>
                  <form action={changeResidentSupportStatusAction}>
                    <input name="threadId" type="hidden" value={selectedThread.id} /><input name="status" type="hidden" value="resolved" />
                    <button className="secondary-button" type="submit"><CheckCircle2 aria-hidden="true" size={17} /> Resolve case</button>
                  </form>
                </div>
              ) : (
                <form action={changeResidentSupportStatusAction} className="resident-closed-actions">
                  <input name="threadId" type="hidden" value={selectedThread.id} /><input name="status" type="hidden" value="in-progress" />
                  <div className="field"><label htmlFor="reopenReason">Reopen reason</label><input id="reopenReason" name="reopenReason" required /></div>
                  <button className="secondary-button" type="submit"><RotateCcw aria-hidden="true" size={17} /> Reopen case</button>
                </form>
              )}

              {selectedThread.escalationStatus !== "none" ? <div className="case-escalation"><CircleAlert aria-hidden="true" size={17} /> Escalated to {humanise(selectedThread.escalationStatus)}</div> : null}
            </>
          ) : (
            <div className="empty-state resident-inbox-empty"><MessageCircle aria-hidden="true" size={34} /><h2>Select a case</h2><p>Choose a resident case to read it, triage it and reply inside the app.</p></div>
          )}
        </section>
      </div>

      {queue.pageCount > 1 ? <nav aria-label="Resident support case pages" className="queue-pagination support-pagination">{queue.page > 1 ? <Link className="secondary-button button-small" href={operationalQueueHref("/crm/messages", queue, { page: queue.page - 1 })} rel="prev">Previous</Link> : <span />}<span>Page {queue.page} of {queue.pageCount}</span>{queue.page < queue.pageCount ? <Link className="secondary-button button-small" href={operationalQueueHref("/crm/messages", queue, { page: queue.page + 1 })} rel="next">Next</Link> : <span />}</nav> : null}

      <section className="panel support-saved-response-builder space-top-lg">
        <div><span className="eyebrow">Team consistency</span><h2>Saved responses</h2><p>Create reusable wording for common questions. Staff can send one directly from an open case.</p></div>
        <form action={createResidentSupportSavedResponseAction} className="support-response-form">
          <div className="field"><label htmlFor="responseTitle">Title</label><input id="responseTitle" maxLength={120} name="title" required /></div>
          <div className="field"><label htmlFor="responseTags">Tags</label><input id="responseTags" name="topicTags" placeholder="notifications, missed-bin" /></div>
          <div className="field support-case-wide"><label htmlFor="responseBody">Resident-visible response</label><textarea id="responseBody" maxLength={5_000} name="body" required rows={4} /></div>
          <button className="secondary-button support-case-wide" type="submit">Save response</button>
        </form>
      </section>

      <div className="truth-note space-top-lg">
        <ShieldCheck aria-hidden="true" size={17} /> {session.platformAdmin
          ? "Platform superadmin view: all council-tagged cases are available."
          : `Council-scoped view: only ${session.organisation.name} cases are available.`} Internal notes never appear to residents. Saved address, postcode and email are not copied into support cases.
      </div>
    </>
  );
}
