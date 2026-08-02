const installationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providerPattern = /^lad-[ensw][0-9]{8}$/;
const partnerPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const itemPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const bulkyBookingReferencePattern = /^WB-[A-Z0-9]{12}$/;

export type BookingStartInput = {
  installationId: string;
  councilProviderId: string;
  itemKey: string;
  quantity: number;
  partnerId?: string;
};

export function parseBulkyBookingStart(value: unknown): BookingStartInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The booking request is invalid.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['installationId', 'councilProviderId', 'itemKey', 'quantity', 'partnerId'].includes(key))) {
    throw new Error('The booking request contains an invalid field.');
  }
  if (typeof input.installationId !== 'string' || !installationPattern.test(input.installationId)) throw new Error('The installation reference is invalid.');
  if (typeof input.councilProviderId !== 'string' || !providerPattern.test(input.councilProviderId)) throw new Error('The council is invalid.');
  if (typeof input.itemKey !== 'string' || !itemPattern.test(input.itemKey)) throw new Error('Choose a valid bulky item.');
  if (!Number.isInteger(input.quantity) || Number(input.quantity) < 1 || Number(input.quantity) > 20) throw new Error('Choose between 1 and 20 items.');
  if (input.partnerId !== undefined && (typeof input.partnerId !== 'string' || !partnerPattern.test(input.partnerId))) throw new Error('The selected service is invalid.');
  return {
    installationId: input.installationId,
    councilProviderId: input.councilProviderId,
    itemKey: input.itemKey,
    quantity: Number(input.quantity),
    partnerId: typeof input.partnerId === 'string' ? input.partnerId : undefined,
  };
}

export function parseBulkyBookingStatus(url: URL) {
  const reference = url.searchParams.get('reference');
  const installationId = url.searchParams.get('installationId');
  if (!reference || !bulkyBookingReferencePattern.test(reference)) throw new Error('The booking reference is invalid.');
  if (!installationId || !installationPattern.test(installationId)) throw new Error('The installation reference is invalid.');
  return { reference, installationId };
}
