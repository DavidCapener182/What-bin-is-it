import Link from "next/link";
import { CalendarClock, Handshake, MessagesSquare, ShieldCheck } from "lucide-react";

import { saveCrmAccountAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requirePlatformAdminSession } from "@/lib/auth";
import { listCrmAccounts, platformOverview } from "@/lib/crm";
import { formatDateTime, humanise } from "@/lib/format";
import { crmAccountTypes, crmStages } from "@/lib/types";

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
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requirePlatformAdminSession();
  const [accounts, overview, params] = await Promise.all([
    listCrmAccounts(),
    platformOverview(),
    searchParams,
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Platform superadmin"
        title="Relationship CRM"
        description="Track council, sponsor and partner conversations, opportunities and follow-ups across the What Bin platform. This workspace contains professional business-contact data only."
        action={(
          <div className="page-header-actions">
            <Link className="secondary-button" href="/crm/messages"><MessagesSquare aria-hidden="true" size={16} /> Correspondence</Link>
            <Link className="secondary-button" href="/">Platform overview</Link>
          </div>
        )}
      />
      <FeedbackBanner {...params} />

      <section aria-label="CRM metrics" className="metric-grid">
        <article className="metric-card tone-blue">
          <span className="metric-label">Relationships</span>
          <strong className="metric-value">{accounts.length}</strong>
          <span className="metric-detail">Councils, sponsors, partners and enterprise prospects</span>
        </article>
        <article className="metric-card tone-teal">
          <span className="metric-label">Active opportunities</span>
          <strong className="metric-value">{overview.crm.activeOpportunities}</strong>
          <span className="metric-detail">Past lead stage and still progressing</span>
        </article>
        <article className="metric-card tone-amber">
          <span className="metric-label">Annual pipeline</span>
          <strong className="metric-value">{gbp(overview.crm.pipelineValuePence)}</strong>
          <span className="metric-detail">Current opportunity values, not booked revenue</span>
        </article>
        <article className="metric-card tone-red">
          <span className="metric-label">Follow-ups due</span>
          <strong className="metric-value">{overview.crm.followUpsDue}</strong>
          <span className="metric-detail">Account-level follow-ups due now</span>
        </article>
      </section>

      <div className="truth-note space-bottom-lg">
        <ShieldCheck aria-hidden="true" size={17} /> Record professional contacts only. Every contact needs a source, lawful basis, suppression control and retention-review date. Resident details never belong in this CRM.
      </div>

      <div className="split-layout">
        <section className="panel form-panel sticky-panel">
          <h2>Add a relationship</h2>
          <p className="form-intro">Start with the organisation. Add named contacts and conversations from its record after saving.</p>
          <form action={saveCrmAccountAction} className="stack-form">
            <div className="field"><label htmlFor="name">Organisation name</label><input id="name" maxLength={180} name="name" required /></div>
            <div className="field-grid">
              <div className="field"><label htmlFor="accountType">Relationship type</label><select id="accountType" name="accountType">{crmAccountTypes.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
              <div className="field"><label htmlFor="stage">Pipeline stage</label><select defaultValue="lead" id="stage" name="stage">{crmStages.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
              <div className="field"><label htmlFor="annualValuePounds">Annual opportunity (£)</label><input id="annualValuePounds" max={10000000} min={0} name="annualValuePounds" type="number" /></div>
              <div className="field"><label htmlFor="websiteUrl">Website</label><input id="websiteUrl" name="websiteUrl" placeholder="https://" type="url" /></div>
              <div className="field field-span"><label htmlFor="summary">Relationship summary</label><textarea id="summary" maxLength={2000} name="summary" placeholder="Why this organisation is relevant and the current commercial context." /></div>
            </div>
            <button className="primary-button" type="submit">Create CRM account</button>
          </form>
        </section>

        <section className="data-list" aria-label="CRM accounts">
          {accounts.length ? accounts.map((account) => (
            <Link className="data-card crm-account-link" href={`/crm/${account.id}`} key={account.id}>
              <div className="data-card-top">
                <div>
                  <h2>{account.name}</h2>
                  <div className="data-meta">
                    <span>{humanise(account.accountType)}</span>
                    <span>{gbp(account.annualValuePence)} annual opportunity</span>
                  </div>
                </div>
                <StatusPill status={account.stage} />
              </div>
              {account.summary ? <p>{account.summary}</p> : null}
              <div className="crm-account-footer">
                <span><CalendarClock aria-hidden="true" size={15} /> Follow-up {formatDateTime(account.nextFollowUpAt)}</span>
                <span>{account.openTaskCount} open task{account.openTaskCount === 1 ? "" : "s"}</span>
                {account.overdueTaskCount ? <span className="crm-overdue">{account.overdueTaskCount} overdue</span> : null}
              </div>
            </Link>
          )) : (
            <div className="empty-state">
              <Handshake aria-hidden="true" size={32} />
              <h2>No relationships recorded</h2>
              <p>Add the first real council, sponsor or partner account. The CRM contains no demonstration or mock records.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
