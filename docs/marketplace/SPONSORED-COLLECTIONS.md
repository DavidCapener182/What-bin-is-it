# Sponsored collection marketplace

What Bin can offer a council-approved paid bulky-waste collector after the free council service and reuse options. It is a controlled booking service, not an open advertising network.

## Resident promise

1. The official council option is shown first.
2. A suitable reuse or charity route is shown next.
3. Any commercial option is labelled **Sponsored paid collection**.
4. The resident sees the item, quantity, total price, operator, response window and booking terms before checkout.
5. The resident pays What Bin through Stripe Checkout.
6. What Bin confirms that the approved operator has accepted and scheduled the collection.
7. The operator share is released only after completion is recorded.
8. A declined booking is refunded to the original payment method.

The app must never imply that a click, checkout start or unpaid session is a confirmed collection.

## Order states

`checkout-created` → `payment-pending` → `awaiting-provider` → `scheduled` → `payout-released`

Exception paths include `provider-declined`, `cancelled`, `refunded` and `payment-failed`. Every material state change is appended to the private `bin_bulky_booking_events` ledger.

## Provider activation gate

A sponsored provider cannot be activated until the back office holds:

- council/platform approval;
- appropriate waste-carrier evidence and review date;
- complaint and suspension contacts;
- service area and accepted items;
- fixed resident price and platform fee;
- response-time commitment;
- resident booking terms;
- a completed Stripe Connect account;
- a successful end-to-end test booking, refund and payout.

The operator's licence and legal obligations must be checked for the nation and waste types in which it operates. Approval is reviewable and can be suspended immediately.

## Money movement

The platform creates the resident charge without paying the operator immediately. After the job is recorded as complete, the back office creates a separate Stripe transfer for the gross amount less the agreed What Bin fee. This lets the platform hold the fulfilment decision, but it also makes the platform responsible for customer service, refunds, chargebacks and reconciliation.

No production provider should be switched on until the commercial agreement defines cancellations, failed access, prohibited items, damage, no-shows, refunds, disputes, tax, insurance, data processing and payout timing.

## Data boundary

The What Bin ledger stores pseudonymous order and commercial data, not the household address. Stripe Checkout collects the fulfilment contact and collection address. Only the minimum details required to accept and complete the collection may be disclosed to the approved operator.

Council users can review their own service evidence. Only a platform superadmin can refund a resident or release an operator payout.

## Required environment

Both the resident gateway deployment and private console deployment require the same platform `STRIPE_SECRET_KEY`. The resident gateway also requires `STRIPE_WEBHOOK_SECRET`. These are server-only values and must never use an `EXPO_PUBLIC_` prefix.
