import Link from "next/link";
import {
  ArrowLeft,
  Inbox,
  MailCheck,
  MailOpen,
  MessagesSquare,
  PlugZap,
  Search,
  ShieldCheck,
} from "lucide-react";

import { CrmMessageComposer } from "@/components/crm-message-composer";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requirePlatformAdminSession } from "@/lib/auth";
import {
  listCrmComposeOptions,
  listCrmMailboxConnections,
  listCrmMessages,
  listCrmThreads,
} from "@/lib/crm";
import { formatDateTime, humanise } from "@/lib/format";
import type { CrmMessage } from "@/lib/types";

const directions = ["sent", "received", "internal"] as const;
const channels = ["email", "phone", "sms", "linkedin", "meeting", "note"] as const;

function allowed<T extends string>(value: string | undefined, choices: readonly T[]) {
  return value && choices.includes(value as T) ? value as T : undefined;
}

function messageAddresses(message: CrmMessage) {
  const from = message.senderAddress ? `From ${message.senderAddress}` : undefined;
  const to = message.recipientAddresses.length
    ? `To ${message.recipientAddresses.join(", ")}`
    : undefined;
  return [from, to].filter(Boolean).join(" · ");
}

export default async function CrmMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    account?: string;
    channel?: string;
    direction?: string;
    error?: string;
    q?: string;
    saved?: string;
  }>;
}) {
  await requirePlatformAdminSession();
  const params = await searchParams;
  const composeOptions = await listCrmComposeOptions();
  const accountId = composeOptions.accounts.some((account) => account.id === params.account)
    ? params.account
    : undefined;
  const direction = allowed(params.direction, directions);
  const channel = allowed(params.channel, channels);
  const [messages, threads, mailboxes] = await Promise.all([
    listCrmMessages({ accountId, direction, channel, query: params.q }),
    listCrmThreads(),
    listCrmMailboxConnections(),
  ]);
  const sent = messages.filter((message) => message.direction === "sent").length;
  const received = messages.filter((message) => message.direction === "received").length;
  const openThreads = threads.filter((thread) => thread.status === "open" || thread.status === "waiting").length;

  return (
    <>
      <PageHeader
        eyebrow="Relationship CRM"
        title="Correspondence"
        description="One platform-wide record of messages sent and received with councils, sponsors, partners and other organisations connected to What Bin."
        action={<Link className="secondary-button" href="/crm"><ArrowLeft aria-hidden="true" size={16} /> Relationship CRM</Link>}
      />
      <FeedbackBanner error={params.error} saved={params.saved} />

      <section aria-label="Correspondence metrics" className="metric-grid correspondence-metrics">
        <article className="metric-card tone-blue">
          <span className="metric-label">Recorded messages</span>
          <strong className="metric-value">{messages.length}</strong>
          <span className="metric-detail">Matching the current filters</span>
        </article>
        <article className="metric-card tone-blue">
          <span className="metric-label">Sent</span>
          <strong className="metric-value">{sent}</strong>
          <span className="metric-detail">Outbound correspondence recorded</span>
        </article>
        <article className="metric-card tone-blue">
          <span className="metric-label">Received</span>
          <strong className="metric-value">{received}</strong>
          <span className="metric-detail">Inbound correspondence recorded</span>
        </article>
        <article className="metric-card tone-blue">
          <span className="metric-label">Open threads</span>
          <strong className="metric-value">{openThreads}</strong>
          <span className="metric-detail">Open or waiting for a reply</span>
        </article>
      </section>

      <section className="mailbox-panel panel space-bottom-lg">
        <div>
          <span className="eyebrow">Automatic capture</span>
          <h2>Mailbox connections</h2>
          <p>
            Manual recording is available now. Gmail or Outlook messages will only appear
            automatically after a secure OAuth mailbox connection is configured.
          </p>
        </div>
        {mailboxes.length ? (
          <div className="mailbox-list">
            {mailboxes.map((mailbox) => (
              <div className="mailbox-row" key={mailbox.id}>
                <MailCheck aria-hidden="true" size={20} />
                <div>
                  <strong>{mailbox.mailboxEmail}</strong>
                  <span>{humanise(mailbox.provider)} · Last sync {formatDateTime(mailbox.lastSyncedAt)}</span>
                </div>
                <StatusPill status={mailbox.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="mailbox-empty">
            <PlugZap aria-hidden="true" size={22} />
            <div><strong>No mailbox connected</strong><span>There is no hidden or simulated email sync.</span></div>
          </div>
        )}
      </section>

      <div className="correspondence-layout">
        <section className="panel form-panel correspondence-composer">
          <h2>Record correspondence</h2>
          <p className="form-intro">
            Save a sent message, a received reply, a call, meeting, LinkedIn conversation or
            internal note against the correct relationship.
          </p>
          {composeOptions.accounts.length ? (
            <CrmMessageComposer
              accounts={composeOptions.accounts}
              contacts={composeOptions.contacts}
              initialAccountId={accountId}
            />
          ) : (
            <div className="empty-state compact-empty">
              <Inbox aria-hidden="true" size={28} />
              <h2>Add an organisation first</h2>
              <p>Create a council, sponsor or partner relationship before recording correspondence.</p>
              <Link className="primary-button" href="/crm">Open relationship CRM</Link>
            </div>
          )}
        </section>

        <section aria-label="Correspondence history">
          <form action="/crm/messages" className="correspondence-filters" method="get">
            <div className="field correspondence-search">
              <label className="sr-only" htmlFor="q">Search correspondence</label>
              <span className="search-field-icon"><Search aria-hidden="true" size={18} /></span>
              <input defaultValue={params.q} id="q" name="q" placeholder="Search messages, organisations or contacts" />
            </div>
            <div className="field">
              <label className="sr-only" htmlFor="account">Organisation</label>
              <select defaultValue={accountId ?? ""} id="account" name="account">
                <option value="">All organisations</option>
                {composeOptions.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="sr-only" htmlFor="directionFilter">Direction</label>
              <select defaultValue={direction ?? ""} id="directionFilter" name="direction">
                <option value="">All directions</option>
                {directions.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="sr-only" htmlFor="channelFilter">Channel</label>
              <select defaultValue={channel ?? ""} id="channelFilter" name="channel">
                <option value="">All channels</option>
                {channels.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}
              </select>
            </div>
            <button className="primary-button" type="submit">Filter</button>
          </form>

          <div className="message-list">
            {messages.length ? messages.map((message) => (
              <article className={`message-card message-${message.direction}`} key={message.id}>
                <div className="message-direction-icon">
                  {message.direction === "received"
                    ? <MailOpen aria-hidden="true" size={20} />
                    : <MailCheck aria-hidden="true" size={20} />}
                </div>
                <div className="message-card-content">
                  <div className="message-card-top">
                    <div>
                      <span className="message-account">
                        <Link href={`/crm/${message.accountId}`}>{message.accountName}</Link>
                        {message.contactName ? ` · ${message.contactName}` : ""}
                      </span>
                      <h2>{message.subject}</h2>
                    </div>
                    <StatusPill status={message.deliveryStatus} />
                  </div>
                  <div className="data-meta">
                    <span>{humanise(message.direction)}</span>
                    <span>{humanise(message.channel)}</span>
                    <time dateTime={message.occurredAt}>{formatDateTime(message.occurredAt)}</time>
                  </div>
                  {messageAddresses(message) ? <div className="message-addresses">{messageAddresses(message)}</div> : null}
                  <details className="message-body">
                    <summary>View full correspondence</summary>
                    <p>{message.body}</p>
                    {message.attachmentNames.length ? (
                      <div className="tag-list">
                        {message.attachmentNames.map((name) => <span className="tag" key={name}>{name}</span>)}
                      </div>
                    ) : null}
                  </details>
                </div>
              </article>
            )) : (
              <div className="empty-state">
                <MessagesSquare aria-hidden="true" size={34} />
                <h2>No correspondence recorded</h2>
                <p>Save the first real sent or received message. No demonstration conversations are inserted.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="truth-note space-top-lg">
        <ShieldCheck aria-hidden="true" size={17} /> Correspondence is restricted to platform superadmins. Use professional business contact details only; resident service records must remain in the resident-service systems.
      </div>
    </>
  );
}
