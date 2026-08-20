import Link from "next/link";
import { CalendarClock, Handshake, MessagesSquare, ShieldCheck } from "lucide-react";

import { saveCrmAccountAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalQueue } from "@/components/operational-queue";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requirePlatformAdminSession } from "@/lib/auth";
import { listCrmAccountsPage, platformCrmMetrics } from "@/lib/crm";
import { formatDateTime, humanise } from "@/lib/format";
import { crmAccountTypes, crmStages } from "@/lib/types";
import { operationalQueueStateFromServerPage, type OperationalQueueSearchParams } from "@/lib/operational-queue";

type PageParams = OperationalQueueSearchParams & { error?: string; saved?: string };

function gbp(pence?: number) {
  if (pence === undefined) return "Not valued";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

export default async function PlatformCrmPage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  await requirePlatformAdminSession();
  const params = await searchParams;
  const [serverPage, metrics] = await Promise.all([
    listCrmAccountsPage(params),
    platformCrmMetrics(),
  ]);
  const queue = operationalQueueStateFromServerPage(serverPage);

  return (
    <>
      <PageHeader
        eyebrow="Platform superadmin"
        title="Relationship CRM"
        description="Track council, sponsor and partner conversations, opportunities and follow-ups across the What Bin platform. This workspace contains professional business-contact data only."
        action={(
          <div className="page-header-actions">
            <Link className="secondary-button" href="/crm/messages"><MessagesSquare aria-hidden="true" size={16} /> Resident inbox</Link>
            <Link className="secondary-button" href="/">Platform overview</Link>
          </div>
        )}
      />
      <FeedbackBanner {...params} />

      <section aria-label="CRM metrics" className="metric-grid">
        <article className="metric-card tone-blue">
          <span className="metric-label">Relationships</span>
          <strong className="metric-value">{metrics.accountCount}</strong>
          <span className="metric-detail">Councils, sponsors, partners and enterprise prospects</span>
        </article>
        <article className="metric-card tone-teal">
          <span className="metric-label">Active opportunities</span>
          <strong className="metric-value">{metrics.activeOpportunities}</strong>
          <span className="metric-detail">Past lead stage and still progressing</span>
        </article>
        <article className="metric-card tone-amber">
          <span className="metric-label">Annual pipeline</span>
          <strong className="metric-value">{gbp(metrics.pipelineValuePence)}</strong>
          <span className="metric-detail">Current opportunity values, not booked revenue</span>
        </article>
        <article className="metric-card tone-red">
          <span className="metric-label">Follow-ups due</span>
          <strong className="metric-value">{metrics.followUpsDue}</strong>
          <span className="metric-detail">Account-level follow-ups due now</span>
        </article>
      </section>

      <div className="truth-note space-bottom-lg">
        <ShieldCheck aria-hidden="true" size={17} /> Record professional contacts only. Every contact needs a source, lawful basis, suppression control and retention-review date. Resident details never belong in this CRM.
      </div>

      <OperationalQueue
        action={(
          <OperationalDrawer description="Start with the organisation. Add named contacts and conversations from its dedicated record after saving." title="Add Relationship" triggerLabel="Add Relationship" triggerStyle="primary">
            <section className="panel form-panel">
              <form action={saveCrmAccountAction} className="stack-form">
                <div className="field"><label htmlFor="name">Organisation name</label><input autoComplete="organization" id="name" maxLength={180} name="name" required /></div>
                <div className="field-grid">
                  <div className="field"><label htmlFor="accountType">Relationship type</label><select id="accountType" name="accountType">{crmAccountTypes.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
                  <div className="field"><label htmlFor="stage">Pipeline stage</label><select defaultValue="lead" id="stage" name="stage">{crmStages.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
                  <div className="field"><label htmlFor="annualValuePounds">Annual opportunity (£)</label><input id="annualValuePounds" inputMode="numeric" max={10000000} min={0} name="annualValuePounds" type="number" /></div>
                  <div className="field"><label htmlFor="websiteUrl">Website</label><input autoComplete="url" id="websiteUrl" name="websiteUrl" placeholder="https://…" type="url" /></div>
                  <div className="field field-span"><label htmlFor="summary">Relationship summary</label><textarea autoComplete="off" id="summary" maxLength={2000} name="summary" placeholder="Current commercial context…" /></div>
                </div>
                <button className="primary-button" type="submit">Create CRM Account</button>
              </form>
            </section>
          </OperationalDrawer>
        )}
        caption="Professional council, sponsor, partner and enterprise relationships, with pipeline stage, value and next-action workload."
        columns={[
          { label: "Organisation", sortKey: "name" },
          { label: "Type" },
          { align: "right", label: "Annual Opportunity", sortKey: "value" },
          { label: "Next Follow-up", sortKey: "follow-up" },
          { align: "right", label: "Open Tasks", sortKey: "tasks" },
          { label: "Stage" },
          { label: "Record" },
        ]}
        emptyState={<div className="empty-state"><Handshake aria-hidden="true" size={32} /><h2>No Matching Relationships</h2><p>Add the first real organisation, or reset this view. The CRM contains no demonstration records.</p></div>}
        filterLabel="relationship types"
        filterOptions={crmAccountTypes.map((value) => ({ label: humanise(value), value }))}
        pathname="/crm"
        searchLabel="Search organisation, summary, type or stage"
        state={queue}
        statusOptions={crmStages.map((value) => ({ label: humanise(value), value }))}
        title="Relationship Pipeline"
        viewKey="crm-accounts"
      >
        {queue.items.map((account) => (
          <tr key={account.id}>
            <td className="queue-primary-cell" data-label="Organisation"><Link href={`/crm/${account.id}`}>{account.name}</Link><small>{account.summary ?? "No relationship summary"}</small></td>
            <td data-label="Type">{humanise(account.accountType)}</td>
            <td className="queue-cell-numeric" data-label="Annual Opportunity">{gbp(account.annualValuePence)}</td>
            <td data-label="Next Follow-up"><CalendarClock aria-hidden="true" size={14} /> {formatDateTime(account.nextFollowUpAt)}</td>
            <td className="queue-cell-numeric" data-label="Open Tasks"><strong>{account.openTaskCount}</strong><small className={account.overdueTaskCount ? "crm-overdue" : undefined}>{account.overdueTaskCount} overdue</small></td>
            <td data-label="Stage"><StatusPill status={account.stage} /></td>
            <td className="queue-cell-actions" data-label="Record"><Link className="secondary-button button-small" href={`/crm/${account.id}`}>Open Record</Link></td>
          </tr>
        ))}
      </OperationalQueue>
    </>
  );
}
