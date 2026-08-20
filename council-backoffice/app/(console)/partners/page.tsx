import { BadgePoundSterling, ShieldCheck } from "lucide-react";
import Link from "next/link";

import {
  acceptMarketplaceBulkyBookingAction,
  changePartnerStatusAction,
  completeMarketplaceBulkyBookingAction,
  confirmExternalBulkyBookingAction,
  declineMarketplaceBulkyBookingAction,
} from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalQueue } from "@/components/operational-queue";
import { PageHeader } from "@/components/page-header";
import { PartnerSetupWizard } from "@/components/partner-setup-wizard";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import {
  consoleE2eBookingsPage,
  consoleE2ePartnersPage,
  isConsoleE2eFixtureSession,
} from "@/lib/console-e2e-fixtures";
import { listBulkyBookingsPage, listPartnersPage } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";
import { marketplacePaymentsConfigured } from "@/lib/marketplace-payments";
import { operationalQueueStateFromServerPage, type OperationalQueueSearchParams } from "@/lib/operational-queue";
import { councilRoleCan } from "@/lib/permissions";

type PageParams = OperationalQueueSearchParams & { error?: string; saved?: string; view?: string };
const partnerStatuses = ["draft", "review", "active", "paused", "ended"] as const;
const bookingStatuses = ["official-handoff", "started", "checkout-created", "payment-pending", "awaiting-provider", "provider-accepted", "scheduled", "confirmed", "completed", "payout-released", "provider-declined", "cancelled", "refunded", "payment-failed"] as const;
const bookingChannels = ["official-council", "external-referral", "stripe-connect"] as const;

function money(pence?: number) {
  return pence === undefined
    ? "Not set"
    : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export default async function PartnersPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canWrite = councilRoleCan(session.role, "partners:write");
  const canApprove = councilRoleCan(session.role, "partners:approve");
  const canSettle = session.platformAdmin && marketplacePaymentsConfigured();
  const params = await searchParams;
  const [partnerServerPage, bookingServerPage] = isConsoleE2eFixtureSession(session)
    ? await Promise.all([consoleE2ePartnersPage(params), consoleE2eBookingsPage(params)])
    : await Promise.all([listPartnersPage(session, params), listBulkyBookingsPage(session, params)]);
  const view = params.view === "bookings" ? "bookings" : "partners";
  const partnerCategories = partnerServerPage.categories;
  const partnerQueue = operationalQueueStateFromServerPage(partnerServerPage);
  const bookingQueue = operationalQueueStateFromServerPage(bookingServerPage);

  const partnerComposer = canWrite ? (
    <OperationalDrawer
      description="Work through the six evidence-backed steps. Browser drafts remain local and activation still requires a separate authorised approval."
      title="Submit Partner for Review"
      triggerLabel="Add Partner"
      triggerStyle="primary"
      wide
    >
      <PartnerSetupWizard
        clearLocalDraft={params.saved === "Partner service saved for review."}
        organisationId={session.organisation.id}
        organisationName={session.organisation.name}
      />
    </OperationalDrawer>
  ) : undefined;

  return (
    <>
      <PageHeader eyebrow="Useful commercial services" title="Partner & Booking Operations" description="Separate partner governance from booking fulfilment while preserving council approval, settlement and resident-protection boundaries." />
      <FeedbackBanner error={params.error} saved={params.saved} />
      <div className="truth-note space-bottom-lg"><ShieldCheck aria-hidden="true" size={17} /> Partner policy: solve the current disposal problem, disclose the commercial relationship and never displace a council service.</div>
      <nav aria-label="Partner operations views" className="queue-view-tabs">
        <Link aria-current={view === "partners" && !params.status ? "page" : undefined} href="/partners?view=partners">Partner Directory</Link>
        <Link aria-current={view === "partners" && params.status === "review" ? "page" : undefined} href="/partners?view=partners&status=review">Approval Queue</Link>
        <Link aria-current={view === "bookings" && !params.status ? "page" : undefined} href="/partners?view=bookings">Booking Operations</Link>
        <Link aria-current={view === "bookings" && params.status === "refunded" ? "page" : undefined} href="/partners?view=bookings&status=refunded">Refunds</Link>
      </nav>

      {view === "partners" ? (
        <OperationalQueue
          action={partnerComposer}
          caption={`Approved and proposed partner services for ${session.organisation.name}, including governance evidence, review date, performance and visibility status.`}
          columns={[
            { label: "Partner", sortKey: "name" },
            { label: "Governance" },
            { label: "Compliance Review", sortKey: "review" },
            { label: "Performance", sortKey: "bookings" },
            { label: "Status" },
            { label: "Actions" },
          ]}
          emptyState={<div className="empty-state"><BadgePoundSterling aria-hidden="true" size={32} /><h2>No Matching Partners</h2><p>No commercial option appears in the resident app until a task-relevant service is reviewed and approved.</p></div>}
          filterLabel="categories"
          filterOptions={partnerCategories.map((value) => ({ label: humanise(value), value }))}
          fixedParams={{ view: "partners" }}
          pathname="/partners"
          searchLabel="Search partner, category, licence or area"
          state={partnerQueue}
          statusOptions={partnerStatuses.map((value) => ({ label: humanise(value), value }))}
          title="Partner Directory"
          viewKey="partners"
        >
          {partnerQueue.items.map((item) => (
            <tr key={item.id}>
              <td className="queue-primary-cell" data-label="Partner"><strong>{item.name}</strong><small>{humanise(item.category)} · {humanise(item.bookingMode)} · priority {item.priority}</small></td>
              <td data-label="Governance">{item.licenceReference ? <strong>{item.licenceReference}</strong> : "Licence reference missing"}<small>{item.termsUrl ? "Terms supplied" : "Terms missing"} · {item.complaintContact ? "Complaint route supplied" : "Complaint route missing"}</small></td>
              <td data-label="Compliance Review">{item.renewalReviewAt ?? "Not scheduled"}<small>{item.evidenceUrl ? "Evidence link supplied" : "Evidence link missing"}</small></td>
              <td data-label="Performance"><strong>{item.conversionCounts["booking-confirmed"] ?? 0} confirmed</strong><small>{item.conversionCounts["listing-viewed"] ?? 0} views · {money(item.confirmedBookingValuePence)} value</small></td>
              <td data-label="Status"><StatusPill status={item.status} /></td>
              <td className="queue-cell-actions" data-label="Actions">
                <OperationalDrawer title={item.name} triggerLabel="Review" triggerStyle="text">
                  <div className="queue-record-detail">
                    <StatusPill status={item.status} />
                    <p>{item.description}</p>
                    <dl className="queue-detail-list">
                      <div><dt>Resident disclosure</dt><dd>{item.disclosureLabel}</dd></div>
                      <div><dt>Commercial model</dt><dd>{humanise(item.referralModel)}</dd></div>
                      <div><dt>Booking route</dt><dd>{humanise(item.bookingMode)}</dd></div>
                      <div><dt>Provider response SLA</dt><dd>{item.providerAcceptanceSlaHours} hours</dd></div>
                      <div><dt>Supported areas</dt><dd>{item.supportedAreaLabels.length ? item.supportedAreaLabels.join(", ") : "Council-wide"}</dd></div>
                      <div><dt>Relevant items</dt><dd>{item.itemKeys.join(", ")}</dd></div>
                      <div><dt>Renewal review</dt><dd>{item.renewalReviewAt ?? "Not scheduled"}</dd></div>
                      <div><dt>Evidence</dt><dd>{item.evidenceUrl ? <a href={item.evidenceUrl} rel="noreferrer" target="_blank">Open Evidence</a> : "Not supplied"}</dd></div>
                    </dl>
                    <div className="partner-evidence-grid"><span><strong>{item.conversionCounts["listing-viewed"] ?? 0}</strong> views</span><span><strong>{item.conversionCounts["website-opened"] ?? 0}</strong> website opens</span><span><strong>{item.conversionCounts["booking-initiated"] ?? 0}</strong> starts</span><span><strong>{item.conversionCounts["booking-confirmed"] ?? 0}</strong> confirmed</span></div>
                    {canApprove && item.status !== "ended" && (item.status === "active" || item.bookingMode !== "stripe-connect" || session.platformAdmin) ? (
                      <form action={changePartnerStatusAction} className="stack-form queue-record-actions">
                        <input name="expectedOrganisationId" type="hidden" value={session.organisation.id} /><input name="id" type="hidden" value={item.id} />
                        {item.status === "active" ? <div className="field"><label htmlFor={`suspension-${item.id}`}>Immediate suspension reason</label><input autoComplete="off" id={`suspension-${item.id}`} maxLength={500} name="suspensionReason" placeholder="Required when pausing…" /></div> : null}
                        <label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" required type="checkbox" value="yes" /><span><strong>Confirm {session.organisation.name}</strong><small>This changes whether residents can see or book {item.name}.</small></span></label>
                        <div className="inline-form">{item.status !== "active" ? <button className="primary-button button-small" name="status" value="active">Approve & Activate</button> : <button className="secondary-button button-small" name="status" value="paused">Suspend Now</button>}<button className="secondary-button button-small" name="status" value="ended">End</button></div>
                      </form>
                    ) : null}
                  </div>
                </OperationalDrawer>
              </td>
            </tr>
          ))}
        </OperationalQueue>
      ) : (
        <OperationalQueue
          caption={`Bulky collection orders for ${session.organisation.name}, with channel, fulfilment timeline, evidenced value, payout and refund state.`}
          columns={[
            { label: "Booking", sortKey: "partner" },
            { label: "Order" },
            { label: "Timeline", sortKey: "started" },
            { align: "right", label: "Financial", sortKey: "amount" },
            { label: "Status", sortKey: "status" },
            { label: "Actions" },
          ]}
          emptyState={<div className="empty-state"><BadgePoundSterling aria-hidden="true" size={32} /><h2>No Matching Bookings</h2><p>Official handoffs and approved partner booking attempts appear after a resident starts one in the app.</p></div>}
          filterLabel="channels"
          filterOptions={bookingChannels.map((value) => ({ label: humanise(value), value }))}
          fixedParams={{ view: "bookings" }}
          pathname="/partners"
          searchLabel="Search reference, provider or item"
          state={bookingQueue}
          statusOptions={bookingStatuses.map((value) => ({ label: humanise(value), value }))}
          title="Booking Operations"
          viewKey="partner-bookings"
        >
          {bookingQueue.items.map((booking) => (
            <tr key={booking.reference}>
              <td className="queue-primary-cell" data-label="Booking"><strong>{booking.partnerName ?? "Official council route"}</strong><small translate="no">{booking.reference} · {humanise(booking.channel)}</small></td>
              <td data-label="Order">{booking.quantity} × {humanise(booking.itemKey)}<small>{booking.providerReference ? `Provider ${booking.providerReference}` : "No provider reference"}</small></td>
              <td data-label="Timeline">Started {formatDateTime(booking.startedAt)}<small>{booking.scheduledFor ? `Scheduled ${formatDateTime(booking.scheduledFor)}` : "Not scheduled"}</small></td>
              <td className="queue-cell-numeric" data-label="Financial">{money(booking.amountPence)}<small>{money(booking.platformFeePence)} evidenced fee · payout {booking.payoutReleased ? "released" : "not released"}</small></td>
              <td data-label="Status"><StatusPill status={booking.status} /></td>
              <td className="queue-cell-actions" data-label="Actions">
                <OperationalDrawer title={`Booking ${booking.reference}`} triggerLabel="Review" triggerStyle="text">
                  <div className="queue-record-detail">
                    <StatusPill status={booking.status} />
                    <dl className="queue-detail-list">
                      <div><dt>Partner</dt><dd>{booking.partnerName ?? "Official council route"}</dd></div>
                      <div><dt>Channel</dt><dd>{humanise(booking.channel)}</dd></div>
                      <div><dt>Order</dt><dd>{booking.quantity} × {humanise(booking.itemKey)}</dd></div>
                      <div><dt>Amount</dt><dd>{money(booking.amountPence)}</dd></div>
                      <div><dt>Started</dt><dd>{formatDateTime(booking.startedAt)}</dd></div>
                      <div><dt>Scheduled</dt><dd>{formatDateTime(booking.scheduledFor)}</dd></div>
                      <div><dt>Completed</dt><dd>{formatDateTime(booking.completedAt)}</dd></div>
                      <div><dt>Refunded</dt><dd>{booking.refunded ? formatDateTime(booking.refundedAt) : "No"}</dd></div>
                    </dl>
                    {canApprove && booking.channel === "external-referral" && booking.status === "started" ? <form action={confirmExternalBulkyBookingAction} className="stack-form"><input name="expectedOrganisationId" type="hidden" value={session.organisation.id} /><input name="reference" type="hidden" value={booking.reference} /><div className="field"><label htmlFor={`provider-reference-${booking.reference}`}>Provider confirmation reference</label><input autoComplete="off" id={`provider-reference-${booking.reference}`} maxLength={160} name="providerReference" required /></div><label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" required type="checkbox" value="yes" /><span><strong>Confirm for {session.organisation.name}</strong><small>Record only evidence actually supplied by the provider.</small></span></label><button className="primary-button button-small" type="submit">Confirm Provider Evidence</button></form> : null}
                    {canSettle && booking.channel === "stripe-connect" && booking.status === "awaiting-provider" ? <div className="queue-record-actions"><form action={acceptMarketplaceBulkyBookingAction} className="stack-form"><input name="expectedOrganisationId" type="hidden" value={session.organisation.id} /><input name="reference" type="hidden" value={booking.reference} /><div className="field"><label htmlFor={`paid-provider-reference-${booking.reference}`}>Provider acceptance reference</label><input autoComplete="off" id={`paid-provider-reference-${booking.reference}`} maxLength={160} name="providerReference" required /></div><div className="field"><label htmlFor={`scheduled-for-${booking.reference}`}>Confirmed collection date and time</label><input id={`scheduled-for-${booking.reference}`} name="scheduledFor" required type="datetime-local" /></div><label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" required type="checkbox" value="yes" /><span><strong>Schedule for {session.organisation.name}</strong><small>Confirm the provider accepted this collection.</small></span></label><button className="primary-button button-small" type="submit">Accept & Schedule</button></form><form action={declineMarketplaceBulkyBookingAction} className="stack-form"><input name="expectedOrganisationId" type="hidden" value={session.organisation.id} /><input name="reference" type="hidden" value={booking.reference} /><label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" required type="checkbox" value="yes" /><span><strong>Refund {booking.reference}</strong><small>Confirm the provider declined this collection.</small></span></label><button className="danger-button button-small" type="submit">Decline & Refund</button></form></div> : null}
                    {canSettle && booking.channel === "stripe-connect" && booking.status === "scheduled" ? <form action={completeMarketplaceBulkyBookingAction} className="stack-form queue-record-actions"><input name="expectedOrganisationId" type="hidden" value={session.organisation.id} /><input name="reference" type="hidden" value={booking.reference} /><label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" required type="checkbox" value="yes" /><span><strong>Release payout for {session.organisation.name}</strong><small>Confirm collection completion before releasing the provider share.</small></span></label><button className="primary-button button-small" type="submit">Complete & Release Payout</button></form> : null}
                  </div>
                </OperationalDrawer>
              </td>
            </tr>
          ))}
        </OperationalQueue>
      )}
      {!marketplacePaymentsConfigured() ? <div className="truth-note space-top-lg">Stripe settlement is not configured. Orders remain visible, but refunds and provider payouts are blocked until the server-only connection is installed.</div> : null}
      <div className="truth-note space-top-lg">Insurance expiry, complaint rate, dispute evidence, automatic suspension rules and payout reconciliation are not represented by the current partner schema. This console does not infer those states from licence or booking timestamps.</div>
    </>
  );
}
