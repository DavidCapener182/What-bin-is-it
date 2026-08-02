import { apiBase } from '@/lib/api-base';
import { residentInstallationId } from '@/lib/resident-council-links';

export type BulkyBookingItemKey = 'sofa' | 'mattress' | 'bed-frame' | 'furniture' | 'large-appliance' | 'other-bulky-item';

export type BulkyBookingStart = {
  reference: string;
  status: string;
  url: string;
  revenueEligible: boolean;
};

export type BulkyBookingStatus = {
  reference: string;
  status: string;
  channel: string;
  itemKey: string;
  quantity: number;
  amountPence?: number;
  partnerName?: string;
  startedAt: string;
  confirmedAt?: string;
};

async function payloadOrError<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: unknown };
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'The booking service could not be reached.');
  return payload;
}
export async function startBulkyBooking(input: {
  councilProviderId: string;
  itemKey: BulkyBookingItemKey;
  quantity: number;
  partnerId?: string;
}) {
  const installationId = await residentInstallationId();
  const response = await fetch(`${apiBase}/bulky-bookings/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, installationId }),
  });
  return payloadOrError<BulkyBookingStart>(response);
}

export async function getBulkyBookingStatus(reference: string) {
  const installationId = await residentInstallationId();
  const query = new URLSearchParams({ reference, installationId });
  const response = await fetch(`${apiBase}/bulky-bookings/status?${query.toString()}`, {
    headers: { accept: 'application/json' },
  });
  return payloadOrError<{ booking: BulkyBookingStatus }>(response).then((payload) => payload.booking);
}
