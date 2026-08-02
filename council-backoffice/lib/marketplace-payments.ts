import Stripe from "stripe";

let stripe: Stripe | undefined;

export function marketplacePaymentsConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function marketplaceStripe() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("Stripe marketplace settlement is not configured for this console.");
  }
  if (!stripe) stripe = new Stripe(secret);
  return stripe;
}

export async function refundMarketplacePayment(input: {
  paymentIntentId: string;
  reference: string;
}) {
  return marketplaceStripe().refunds.create({
    payment_intent: input.paymentIntentId,
    reason: "requested_by_customer",
    metadata: {
      channel: "bulky-booking",
      bookingReference: input.reference,
      reason: "provider-declined",
    },
  }, { idempotencyKey: `bulky-refund-${input.reference}` });
}

export async function releaseMarketplacePayout(input: {
  amountPence: number;
  chargeId: string;
  destinationAccountId: string;
  reference: string;
}) {
  return marketplaceStripe().transfers.create({
    amount: input.amountPence,
    currency: "gbp",
    destination: input.destinationAccountId,
    source_transaction: input.chargeId,
    transfer_group: input.reference,
    metadata: {
      channel: "bulky-booking",
      bookingReference: input.reference,
    },
  }, { idempotencyKey: `bulky-payout-${input.reference}` });
}
