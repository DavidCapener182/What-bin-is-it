import { binDatabase } from './bin-database';
import { isPilotParticipantId } from './pilot-analytics';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const residentEvents = new Set([
  'listing-viewed',
  'website-opened',
  'phone-tapped',
  'directions-requested',
  'booking-initiated',
]);

export type PartnerConversionInput = {
  installationId: string;
  partnerId: string;
  eventName: string;
};

export function parsePartnerConversion(value: unknown): PartnerConversionInput {
  if (!value || typeof value !== 'object') throw new Error('The partner event is invalid.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['installationId', 'partnerId', 'eventName'].includes(key))) {
    throw new Error('The partner event contains an invalid field.');
  }
  if (!isPilotParticipantId(input.installationId)) throw new Error('The installation reference is invalid.');
  if (typeof input.partnerId !== 'string' || !uuidPattern.test(input.partnerId)) throw new Error('The partner reference is invalid.');
  if (typeof input.eventName !== 'string' || !residentEvents.has(input.eventName)) throw new Error('The partner event is not allowed.');
  return input as PartnerConversionInput;
}

export async function savePartnerConversion(input: PartnerConversionInput) {
  const sql = binDatabase();
  const rows = await sql<{ id: string }[]>`
    INSERT INTO bin_partner_conversion_events (
      partner_id, organisation_id, installation_id, event_name
    )
    SELECT partner.id, partner.organisation_id, ${input.installationId}::uuid, ${input.eventName}
    FROM bin_council_partners AS partner
    WHERE partner.id = ${input.partnerId}::uuid
      AND partner.status = 'active'
      AND (partner.starts_at IS NULL OR partner.starts_at <= now())
      AND (partner.ends_at IS NULL OR partner.ends_at > now())
    RETURNING id::text
  `;
  if (!rows[0]) throw new Error('The partner listing is not active.');
  return { recorded: true };
}
