import { createHash, randomBytes } from 'node:crypto';
import type Stripe from 'stripe';

import { binDatabase } from './bin-database';
import {
  bulkyBookingReferencePattern,
  type BookingStartInput,
} from './bulky-booking-validation';
import { safeCheckoutOrigin, stripeClient } from './web-billing';

const officialBulkyWasteUrl = 'https://www.gov.uk/collection-large-waste-items';

export { parseBulkyBookingStart, parseBulkyBookingStatus } from './bulky-booking-validation';

function publicReference() {
  return `WB-${randomBytes(6).toString('hex').toUpperCase()}`;
}

function referralHash(reference: string) {
  return createHash('sha256').update(reference, 'utf8').digest('hex');
}

export async function startBulkyBooking(input: BookingStartInput, requestUrl: string) {
  const sql = binDatabase();
  const recent = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM bin_bulky_bookings
    WHERE installation_id = ${input.installationId}::uuid
      AND started_at >= now() - interval '15 minutes'
  `;
  if ((recent[0]?.count ?? 0) >= 5) throw new Error('Too many booking attempts. Try again in 15 minutes.');
  const reference = publicReference();
  if (!input.partnerId) {
    await sql`
      INSERT INTO bin_bulky_bookings (
        public_reference, organisation_id, installation_id, council_provider_id,
        booking_channel, item_key, quantity, status
      )
      SELECT ${reference}, organisation.id, ${input.installationId}::uuid, ${input.councilProviderId},
        'official-council', ${input.itemKey}, ${input.quantity}, 'official-handoff'
      FROM (SELECT 1) seed
      LEFT JOIN bin_council_organisations organisation
        ON organisation.provider_id = ${input.councilProviderId}
      LIMIT 1
    `;
    return {
      reference,
      status: 'official-handoff',
      url: officialBulkyWasteUrl,
      revenueEligible: false,
    };
  }

  const partners = await sql<{
    id: string;
    organisation_id: string;
    name: string;
    service_url: string;
    booking_mode: 'none' | 'external-referral' | 'stripe-connect';
    booking_price_pence: number | null;
    platform_fee_pence: number | null;
    stripe_account_id: string | null;
  }[]>`
    SELECT partner.id, partner.organisation_id, partner.name, partner.service_url,
      partner.booking_mode, partner.booking_price_pence, partner.platform_fee_pence,
      partner.stripe_account_id
    FROM bin_council_partners partner
    JOIN bin_council_organisations organisation ON organisation.id = partner.organisation_id
    LEFT JOIN bin_council_feature_flags flags ON flags.organisation_id = organisation.id
    WHERE partner.id = ${input.partnerId}::uuid
      AND organisation.provider_id = ${input.councilProviderId}
      AND partner.category = 'bulky-waste'
      AND partner.status = 'active'
      AND partner.booking_mode <> 'none'
      AND coalesce(flags.bulky_waste_booking, false)
      AND (partner.starts_at IS NULL OR partner.starts_at <= now())
      AND (partner.ends_at IS NULL OR partner.ends_at > now())
    LIMIT 1
  `;
  const partner = partners[0];
  if (!partner) throw new Error('This bulky-waste service is not currently available.');
  const amountPence = partner.booking_price_pence === null ? null : partner.booking_price_pence * input.quantity;
  const feePence = partner.platform_fee_pence === null ? null : partner.platform_fee_pence * input.quantity;
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO bin_bulky_bookings (
        public_reference, organisation_id, partner_id, installation_id,
        council_provider_id, booking_channel, item_key, quantity,
        amount_pence, platform_fee_pence, status
      ) VALUES (
        ${reference}, ${partner.organisation_id}::uuid, ${partner.id}::uuid,
        ${input.installationId}::uuid, ${input.councilProviderId}, ${partner.booking_mode},
        ${input.itemKey}, ${input.quantity}, ${amountPence}, ${feePence}, 'started'
      )
    `;
    await transaction`
      INSERT INTO bin_partner_conversion_events (
        partner_id, organisation_id, installation_id, event_name, referral_token_hash
      ) VALUES (
        ${partner.id}::uuid, ${partner.organisation_id}::uuid, ${input.installationId}::uuid,
        'booking-initiated', ${referralHash(reference)}
      )
    `;
  });

  if (partner.booking_mode === 'external-referral') {
    const destination = new URL(partner.service_url);
    destination.searchParams.set('what_bin_ref', reference);
    return { reference, status: 'started', url: destination.toString(), revenueEligible: feePence !== null };
  }

  if (
    amountPence === null
    || feePence === null
    || !partner.stripe_account_id
    || !process.env.STRIPE_SECRET_KEY?.trim()
  ) throw new Error('Secure partner checkout is not configured for this service.');
  const origin = safeCheckoutOrigin(requestUrl);
  try {
    const metadata = {
      channel: 'bulky-booking',
      bookingReference: reference,
      partnerId: partner.id,
      installationId: input.installationId,
      councilProviderId: input.councilProviderId,
    };
    const session = await stripeClient().checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: input.quantity,
        price_data: {
          currency: 'gbp',
          unit_amount: partner.booking_price_pence!,
          product_data: {
            name: `${partner.name} bulky-waste collection`,
            description: `Collection booking for ${input.itemKey.replace(/-/g, ' ')}.`,
          },
        },
      }],
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['GB'] },
      phone_number_collection: { enabled: true },
      metadata,
      payment_intent_data: {
        application_fee_amount: feePence,
        metadata,
        on_behalf_of: partner.stripe_account_id,
        transfer_data: { destination: partner.stripe_account_id },
      },
      success_url: `${origin}/bulky-booking?booking=success&reference=${reference}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/bulky-booking?booking=cancelled&reference=${reference}`,
    });
    if (!session.url) throw new Error('Stripe did not return a secure checkout URL.');
    await sql`
      UPDATE bin_bulky_bookings
      SET status = 'checkout-created', stripe_checkout_session_id = ${session.id}, updated_at = now()
      WHERE public_reference = ${reference}
    `;
    return { reference, status: 'checkout-created', url: session.url, revenueEligible: true };
  } catch (error) {
    await sql`
      UPDATE bin_bulky_bookings SET status = 'payment-failed', updated_at = now()
      WHERE public_reference = ${reference}
    `;
    throw error;
  }
}

export async function bulkyBookingStatus(reference: string, installationId: string) {
  const rows = await binDatabase()<{
    public_reference: string;
    status: string;
    booking_channel: string;
    item_key: string;
    quantity: number;
    amount_pence: number | null;
    partner_name: string | null;
    started_at: Date;
    confirmed_at: Date | null;
  }[]>`
    SELECT booking.public_reference, booking.status, booking.booking_channel,
      booking.item_key, booking.quantity, booking.amount_pence, partner.name AS partner_name,
      booking.started_at, booking.confirmed_at
    FROM bin_bulky_bookings booking
    LEFT JOIN bin_council_partners partner ON partner.id = booking.partner_id
    WHERE booking.public_reference = ${reference}
      AND booking.installation_id = ${installationId}::uuid
    LIMIT 1
  `;
  const item = rows[0];
  if (!item) throw new Error('The booking could not be found on this device.');
  return {
    reference: item.public_reference,
    status: item.status,
    channel: item.booking_channel,
    itemKey: item.item_key,
    quantity: item.quantity,
    amountPence: item.amount_pence ?? undefined,
    partnerName: item.partner_name ?? undefined,
    startedAt: item.started_at.toISOString(),
    confirmedAt: item.confirmed_at?.toISOString(),
  };
}

function paymentIntentId(value: string | Stripe.PaymentIntent | null | undefined) {
  return typeof value === 'string' ? value : value?.id;
}

export async function processBulkyBookingStripeEvent(event: Stripe.Event) {
  if (
    event.type === 'checkout.session.completed'
    || event.type === 'checkout.session.async_payment_succeeded'
    || event.type === 'checkout.session.async_payment_failed'
    || event.type === 'checkout.session.expired'
  ) {
    const session = event.data.object;
    if (session.metadata?.channel !== 'bulky-booking') return false;
    const reference = session.metadata.bookingReference;
    if (!bulkyBookingReferencePattern.test(reference ?? '')) throw new Error('The bulky booking event has no valid reference.');
    const paid = event.type === 'checkout.session.completed'
      || event.type === 'checkout.session.async_payment_succeeded';
    const status = paid
      ? (session.payment_status === 'paid' || session.payment_status === 'no_payment_required' ? 'confirmed' : 'checkout-created')
      : event.type === 'checkout.session.expired'
        ? 'cancelled'
        : 'payment-failed';
    const rows = await binDatabase()<{
      partner_id: string | null;
      organisation_id: string | null;
      installation_id: string;
    }[]>`
      UPDATE bin_bulky_bookings SET
        status = ${status},
        stripe_checkout_session_id = ${session.id},
        stripe_payment_intent_id = ${paymentIntentId(session.payment_intent) ?? null},
        confirmed_at = CASE WHEN ${status} = 'confirmed' THEN coalesce(confirmed_at, now()) ELSE confirmed_at END,
        cancelled_at = CASE WHEN ${status} = 'cancelled' THEN coalesce(cancelled_at, now()) ELSE cancelled_at END,
        updated_at = now()
      WHERE public_reference = ${reference}
      RETURNING partner_id, organisation_id, installation_id
    `;
    const booking = rows[0];
    if (!booking) throw new Error('The bulky booking was not found.');
    if (status === 'confirmed' && booking.partner_id && booking.organisation_id) {
      await binDatabase()`
        INSERT INTO bin_partner_conversion_events (
          partner_id, organisation_id, installation_id, event_name, referral_token_hash
        ) SELECT
          ${booking.partner_id}::uuid, ${booking.organisation_id}::uuid,
          ${booking.installation_id}::uuid, 'booking-confirmed', ${referralHash(reference!)}
        WHERE NOT EXISTS (
          SELECT 1 FROM bin_partner_conversion_events
          WHERE partner_id = ${booking.partner_id}::uuid
            AND event_name = 'booking-confirmed'
            AND referral_token_hash = ${referralHash(reference!)}
        )
      `;
    }
    return true;
  }
  return false;
}
