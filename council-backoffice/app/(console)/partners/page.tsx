import { BadgePoundSterling, ShieldCheck } from "lucide-react";

import {
  acceptMarketplaceBulkyBookingAction,
  changePartnerStatusAction,
  completeMarketplaceBulkyBookingAction,
  confirmExternalBulkyBookingAction,
  declineMarketplaceBulkyBookingAction,
} from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { PartnerSetupWizard } from "@/components/partner-setup-wizard";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { listBulkyBookings, listPartners } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";
import { councilRoleCan } from "@/lib/permissions";
import { marketplacePaymentsConfigured } from "@/lib/marketplace-payments";

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canWrite = councilRoleCan(session.role, "partners:write");
  const canApprove = councilRoleCan(session.role, "partners:approve");
  const canSettle = session.platformAdmin && marketplacePaymentsConfigured();
  const [items, bookings, params] = await Promise.all([listPartners(session), listBulkyBookings(session), searchParams]);
  const money = (pence?: number) => pence === undefined
    ? "Not set"
    : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
  return (
    <>
      <PageHeader eyebrow="Useful commercial services" title="Partner services" description="Task-relevant partners only. Official council and free options always appear first, every paid placement is labelled, and activation requires a separate approval role." />
      <FeedbackBanner {...params} />
      <div className="truth-note space-bottom-lg"><ShieldCheck aria-hidden="true" size={17} /> Partner policy: solve the current disposal problem, disclose the commercial relationship and never displace a council service.</div>
      <div className={canWrite ? "partner-page-layout" : ""}>
        {canWrite ? <PartnerSetupWizard
          clearLocalDraft={params.saved === "Partner service saved for review."}
          organisationId={session.organisation.id}
          organisationName={session.organisation.name}
        /> : null}
        <section className="data-list">
          {items.length ? items.map((item) => <article className="data-card" key={item.id}>
            <div className="data-card-top"><div><h2>{item.name}</h2><div className="data-meta"><span>{humanise(item.category)}</span><span>{humanise(item.referralModel)}</span><span>{humanise(item.bookingMode)}</span><span>Priority {item.priority}</span></div></div><StatusPill status={item.status} /></div>
            <p>{item.description}</p><div className="tag-list"><span className="tag">{item.disclosureLabel}</span>{item.itemKeys.map((key) => <span className="tag" key={key}>{key}</span>)}{item.supportedAreaLabels.map((area) => <span className="tag" key={area}>{area}</span>)}</div>
            <div className="partner-evidence-grid">
              <span><strong>{item.conversionCounts['listing-viewed'] ?? 0}</strong> views</span>
              <span><strong>{item.conversionCounts['website-opened'] ?? 0}</strong> website opens</span>
              <span><strong>{item.conversionCounts['booking-initiated'] ?? 0}</strong> booking starts</span>
              <span><strong>{item.conversionCounts['booking-confirmed'] ?? 0}</strong> confirmed referrals</span>
              <span><strong>{money(item.confirmedBookingValuePence)}</strong> confirmed booking value</span>
              <span><strong>{money(item.confirmedPlatformFeePence)}</strong> evidenced What Bin fees</span>
            </div>
            <p className="data-meta">{item.bookingMode === "stripe-connect" ? `${money(item.bookingPricePence)} per item · ${money(item.platformFeePence)} fee before Stripe costs · ${item.providerAcceptanceSlaHours}h provider response · Stripe account configured: ${item.stripeAccountId ? "Yes" : "No"}` : item.bookingMode === "external-referral" ? "Provider confirmation is required before commission is counted." : "No booking or referral tracking on this listing."}</p>
            <p className="data-meta">{item.termsUrl ? <a href={item.termsUrl} rel="noreferrer" target="_blank">Booking terms</a> : "No booking terms supplied"} · {item.licenceReference ? `Carrier ${item.licenceReference}` : "Carrier reference missing"}</p>
            <p className="data-meta">{item.renewalReviewAt ? `Review ${item.renewalReviewAt}` : 'No renewal review set'} · {item.complaintContact ? `Complaints: ${item.complaintContact}` : 'Complaint route not supplied'}</p>
            {item.bookingMode === "stripe-connect" && item.status !== "active" && !session.platformAdmin ? <p className="data-meta">Platform superadmin activation is required before residents can pay through What Bin.</p> : null}
            {canApprove && item.status !== "ended" && (item.status === "active" || item.bookingMode !== "stripe-connect" || session.platformAdmin) ? <div className="data-card-actions"><form action={changePartnerStatusAction} className="stack-form"><input name="expectedOrganisationId" type="hidden" value={session.organisation.id} /><input name="id" type="hidden" value={item.id} />{item.status === "active" ? <div className="field"><label htmlFor={`suspension-${item.id}`}>Immediate suspension reason</label><input id={`suspension-${item.id}`} maxLength={500} name="suspensionReason" placeholder="Required when pausing an active listing" /></div> : null}<label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" required type="checkbox" value="yes" /><span><strong>Confirm {session.organisation.name}</strong><small>This changes whether residents can see or book {item.name}.</small></span></label><div className="inline-form">{item.status !== "active" ? <button className="primary-button button-small" name="status" value="active">Approve & activate</button> : <button className="secondary-button button-small" name="status" value="paused">Suspend now</button>}<button className="secondary-button button-small" name="status" value="ended">End</button></div></form></div> : null}
          </article>) : <div className="empty-state"><BadgePoundSterling aria-hidden="true" size={32} /><h2>No partners configured</h2><p>No commercial option will appear in the resident app until a task-relevant service is reviewed and approved.</p></div>}
        </section>
      </div>
      <section className="space-top-xl" id="bulky-bookings">
        <PageHeader eyebrow="Controlled marketplace" title="Bulky collection orders" description="Residents pay What Bin, the platform confirms the job with an approved collector, and provider payout is released only after collection is recorded." />
        {!marketplacePaymentsConfigured() ? <div className="truth-note space-bottom-lg">Stripe settlement is not configured in this console. Orders remain visible, but refunds and provider payouts are blocked until the server-only Stripe key is installed.</div> : null}
        <div className="data-list">
          {bookings.length ? bookings.map((booking) => <article className="data-card" key={booking.reference}>
            <div className="data-card-top"><div><h2>{booking.partnerName ?? "Official council route"}</h2><div className="data-meta"><span>{booking.reference}</span><span>{humanise(booking.channel)}</span><span>{formatDateTime(booking.startedAt)}</span></div></div><StatusPill status={booking.status} /></div>
            <p>{booking.quantity} × {humanise(booking.itemKey)}{booking.amountPence !== undefined ? ` · ${money(booking.amountPence)}` : ""}</p>
            <p className="data-meta">{booking.status === "payout-released" || booking.status === "completed" || booking.status === "confirmed" ? `${money(booking.platformFeePence)} evidenced What Bin fee before Stripe costs${booking.providerReference ? ` · Provider reference ${booking.providerReference}` : ""}` : booking.status === "awaiting-provider" || booking.status === "scheduled" ? "Resident payment received; fee is not earned until collection completes." : "No revenue recognised for this record."}</p>
            {booking.scheduledFor ? <p className="data-meta">Scheduled {formatDateTime(booking.scheduledFor)}</p> : null}
            {session.platformAdmin && booking.paymentIntentId ? <p className="data-meta"><a href={`https://dashboard.stripe.com/payments/${booking.paymentIntentId}`} rel="noreferrer" target="_blank">Open secure Stripe payment</a> to view the fulfilment contact and collection address.</p> : null}
            {canApprove && booking.channel === "external-referral" && booking.status === "started" ? <form action={confirmExternalBulkyBookingAction} className="stack-form"><input name="reference" type="hidden" value={booking.reference} /><div className="field"><label htmlFor={`provider-reference-${booking.reference}`}>Provider confirmation reference</label><input id={`provider-reference-${booking.reference}`} maxLength={160} name="providerReference" required /></div><button className="primary-button button-small" type="submit">Confirm from provider evidence</button></form> : null}
            {canSettle && booking.channel === "stripe-connect" && booking.status === "awaiting-provider" ? <div className="data-card-actions">
              <form action={acceptMarketplaceBulkyBookingAction} className="stack-form"><input name="expectedOrganisationId" type="hidden" value={session.organisation.id} /><input name="reference" type="hidden" value={booking.reference} /><div className="field"><label htmlFor={`paid-provider-reference-${booking.reference}`}>Provider acceptance reference</label><input id={`paid-provider-reference-${booking.reference}`} maxLength={160} name="providerReference" required /></div><div className="field"><label htmlFor={`scheduled-for-${booking.reference}`}>Confirmed collection date and time</label><input id={`scheduled-for-${booking.reference}`} name="scheduledFor" required type="datetime-local" /></div><label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" required type="checkbox" value="yes" /><span><strong>Schedule for {session.organisation.name}</strong><small>Confirm the provider has accepted {booking.reference}.</small></span></label><button className="primary-button button-small" type="submit">Provider accepted — schedule collection</button></form>
              <form action={declineMarketplaceBulkyBookingAction} className="stack-form"><input name="expectedOrganisationId" type="hidden" value={session.organisation.id} /><input name="reference" type="hidden" value={booking.reference} /><label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" required type="checkbox" value="yes" /><span><strong>Refund {booking.reference}</strong><small>Confirm the provider declined this {session.organisation.name} collection. {booking.amountPence !== undefined ? `${money(booking.amountPence)} will be refunded.` : "The resident payment will be refunded."}</small></span></label><button className="danger-button button-small" type="submit">Provider declined — refund resident</button></form>
            </div> : null}
            {canSettle && booking.channel === "stripe-connect" && booking.status === "scheduled" ? <form action={completeMarketplaceBulkyBookingAction} className="stack-form"><input name="expectedOrganisationId" type="hidden" value={session.organisation.id} /><input name="reference" type="hidden" value={booking.reference} /><label className="council-action-confirmation compact-confirmation"><input name="confirmCouncilAction" required type="checkbox" value="yes" /><span><strong>Release payout for {session.organisation.name}</strong><small>Confirm the collection is complete. This transfers the provider share and records the evidenced What Bin fee.</small></span></label><button className="primary-button button-small" type="submit">Collection completed — release provider payout</button></form> : null}
          </article>) : <div className="empty-state"><BadgePoundSterling aria-hidden="true" size={32} /><h2>No bulky bookings yet</h2><p>Official handoffs and approved partner booking attempts will appear after a resident starts one in the app.</p></div>}
        </div>
      </section>
    </>
  );
}
