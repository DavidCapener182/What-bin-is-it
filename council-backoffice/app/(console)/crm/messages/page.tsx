import Link from "next/link";
import {
  CheckCircle2,
  Inbox,
  MessageCircle,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  changeResidentSupportStatusAction,
  replyToResidentSupportAction,
} from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { formatDateTime, humanise } from "@/lib/format";
import {
  listResidentSupportThreads,
  residentSupportThread,
  type ResidentSupportStatus,
} from "@/lib/resident-support";

const statuses = ["waiting-support", "waiting-resident", "closed"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowedStatus(value?: string): ResidentSupportStatus | undefined {
  return value && statuses.includes(value as ResidentSupportStatus)
    ? value as ResidentSupportStatus
    : undefined;
}

function threadStatus(status: ResidentSupportStatus) {
  if (status === "waiting-support") return "Needs reply";
  if (status === "waiting-resident") return "Waiting for resident";
  return "Closed";
}

export default async function ResidentInboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    q?: string;
    saved?: string;
    status?: string;
    thread?: string;
  }>;
}) {
  const session = await requireCouncilSession("support:view");
  const params = await searchParams;
  const status = allowedStatus(params.status);
  const [allThreads, threads] = await Promise.all([
    listResidentSupportThreads(session),
    listResidentSupportThreads(session, { query: params.q, status }),
  ]);
  const requestedThreadId = typeof params.thread === "string" && uuidPattern.test(params.thread)
    ? params.thread
    : undefined;
  const selectedThreadId = requestedThreadId ?? threads[0]?.id;
  const selectedThread = selectedThreadId
    ? await residentSupportThread(session, selectedThreadId)
    : undefined;
  const needsReply = allThreads.filter((thread) => thread.status === "waiting-support").length;
  const waitingResident = allThreads.filter((thread) => thread.status === "waiting-resident").length;
  const closed = allThreads.filter((thread) => thread.status === "closed").length;

  return (
    <>
      <PageHeader
        eyebrow="Resident services"
        title="In-app support inbox"
        description={session.platformAdmin
          ? "Messages sent by residents across every council from the What Bin web or mobile app. Replies are delivered inside the app."
          : `Messages sent through the app by residents linked to ${session.organisation.name}. Other councils' conversations are not available in this portal.`}
        action={session.platformAdmin
          ? <Link className="secondary-button" href="/crm">Relationship CRM</Link>
          : undefined}
      />
      <FeedbackBanner error={params.error} saved={params.saved} />

      <section aria-label="Resident support metrics" className="metric-grid correspondence-metrics">
        <article className="metric-card tone-blue">
          <span className="metric-label">Conversations</span>
          <strong className="metric-value">{allThreads.length}</strong>
          <span className="metric-detail">All in-app support threads</span>
        </article>
        <article className="metric-card tone-red">
          <span className="metric-label">Needs reply</span>
          <strong className="metric-value">{needsReply}</strong>
          <span className="metric-detail">A resident sent the latest message</span>
        </article>
        <article className="metric-card tone-teal">
          <span className="metric-label">Waiting for resident</span>
          <strong className="metric-value">{waitingResident}</strong>
          <span className="metric-detail">Support has replied in the app</span>
        </article>
        <article className="metric-card tone-amber">
          <span className="metric-label">Closed</span>
          <strong className="metric-value">{closed}</strong>
          <span className="metric-detail">Resolved support conversations</span>
        </article>
      </section>

      <section className="panel resident-inbox-intro space-bottom-lg">
        <div className="resident-inbox-mark"><MessageCircle aria-hidden="true" size={24} /></div>
        <div>
          <span className="eyebrow">One private channel</span>
          <h2>Resident app ↔ What Bin back office</h2>
          <p>
            {session.platformAdmin
              ? "Residents open Help and support, choose a topic and send a message. This platform view includes every council-tagged conversation and messages without a selected council."
              : `This inbox includes only conversations created while ${session.organisation.name} was the resident's selected council. Replies appear inside the resident app.`}
          </p>
        </div>
      </section>

      <form action="/crm/messages" className="correspondence-filters resident-inbox-filters" method="get">
        <div className="field correspondence-search">
          <label className="sr-only" htmlFor="q">Search resident conversations</label>
          <span className="search-field-icon"><Search aria-hidden="true" size={18} /></span>
          <input defaultValue={params.q} id="q" name="q" placeholder="Search topic, council or conversation reference" />
        </div>
        <div className="field">
          <label className="sr-only" htmlFor="status">Conversation status</label>
          <select defaultValue={status ?? ""} id="status" name="status">
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{threadStatus(value)}</option>)}
          </select>
        </div>
        <button className="primary-button" type="submit">Filter</button>
      </form>

      <div className="resident-inbox-layout">
        <section aria-label="Resident support conversations" className="resident-thread-list">
          {threads.length ? threads.map((thread) => (
            <Link
              className={`resident-thread-card${selectedThread?.id === thread.id ? " resident-thread-selected" : ""}`}
              href={`/crm/messages?thread=${thread.id}`}
              key={thread.id}
            >
              <div className="resident-thread-icon"><UserRound aria-hidden="true" size={20} /></div>
              <div className="resident-thread-copy">
                <div className="resident-thread-top">
                  <strong>{thread.subject}</strong>
                  <time dateTime={thread.lastMessageAt}>{formatDateTime(thread.lastMessageAt)}</time>
                </div>
                <span>{thread.residentReference}{thread.councilName ? ` · ${thread.councilName}` : ""}</span>
                <div className="resident-thread-footer">
                  <StatusPill status={thread.status} />
                  <span>{thread.lastSender === "resident" ? "Resident replied" : "Support replied"}</span>
                </div>
              </div>
            </Link>
          )) : (
            <div className="empty-state resident-inbox-empty">
              <Inbox aria-hidden="true" size={34} />
              <h2>No resident conversations</h2>
              <p>Messages sent from Help and support in the resident app will appear here.</p>
            </div>
          )}
        </section>

        <section aria-label="Selected resident conversation" className="panel resident-conversation">
          {selectedThread ? (
            <>
              <div className="resident-conversation-head">
                <div>
                  <span className="eyebrow">{humanise(selectedThread.topic)}</span>
                  <h2>{selectedThread.subject}</h2>
                  <p>
                    {selectedThread.residentReference}
                    {selectedThread.councilName ? ` · ${selectedThread.councilName}` : " · No council selected"}
                  </p>
                </div>
                <StatusPill status={selectedThread.status} />
              </div>

              <div className="resident-message-stack">
                {selectedThread.messages.map((message) => (
                  <article className={`resident-message resident-message-${message.sender}`} key={message.id}>
                    <div className="resident-message-bubble">
                      <p>{message.body}</p>
                      <span>
                        {message.sender === "resident" ? "Resident" : "What Bin support"}
                        {" · "}
                        <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              {selectedThread.status !== "closed" ? (
                <div className="resident-reply-area">
                  <form action={replyToResidentSupportAction} className="resident-reply-form">
                    <input name="threadId" type="hidden" value={selectedThread.id} />
                    <div className="field">
                      <label htmlFor="residentReply">Reply in the app</label>
                      <textarea
                        id="residentReply"
                        maxLength={5_000}
                        name="body"
                        placeholder="Write a clear support reply. The resident will see this in What Bin."
                        required
                        rows={5}
                      />
                      <span className="help-text">Do not ask the resident to email. Keep the whole conversation in the app.</span>
                    </div>
                    <button className="primary-button" type="submit"><Send aria-hidden="true" size={17} /> Send reply</button>
                  </form>
                  <form action={changeResidentSupportStatusAction}>
                    <input name="threadId" type="hidden" value={selectedThread.id} />
                    <input name="status" type="hidden" value="closed" />
                    <button className="secondary-button" type="submit">
                      <CheckCircle2 aria-hidden="true" size={17} /> Close conversation
                    </button>
                  </form>
                </div>
              ) : (
                <form action={changeResidentSupportStatusAction} className="resident-closed-actions">
                  <input name="threadId" type="hidden" value={selectedThread.id} />
                  <input name="status" type="hidden" value="waiting-support" />
                  <button className="secondary-button" type="submit"><RotateCcw aria-hidden="true" size={17} /> Reopen conversation</button>
                </form>
              )}
            </>
          ) : (
            <div className="empty-state resident-inbox-empty">
              <MessageCircle aria-hidden="true" size={34} />
              <h2>Select a conversation</h2>
              <p>Choose a resident thread to read it and reply inside the app.</p>
            </div>
          )}
        </section>
      </div>

      <div className="truth-note space-top-lg">
        <ShieldCheck aria-hidden="true" size={17} /> {session.platformAdmin
          ? "Platform superadmin view: all in-app resident conversations are available."
          : `Council-scoped view: only ${session.organisation.name} conversations are available.`} The inbox stores the account reference, message text and optional council identifier—not the resident&apos;s saved address, postcode or email.
      </div>
    </>
  );
}
