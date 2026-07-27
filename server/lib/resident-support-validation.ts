export const residentSupportTopics = [
  'app-help',
  'notifications',
  'address',
  'accessibility',
  'app-problem',
  'guide-item',
  'other',
] as const;

export type ResidentSupportTopic = (typeof residentSupportTopics)[number];
export type ResidentSupportStatus = 'waiting-support' | 'waiting-resident' | 'closed';

export type NewResidentSupportThreadInput = {
  topic: ResidentSupportTopic;
  detail: string;
  councilProviderId?: string;
  councilName?: string;
  clientRequestId: string;
};

export type ResidentSupportReplyInput = {
  threadId: string;
  detail: string;
  clientMessageId: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providerPattern = /^lad-[ensw]\d{8}$/;

function requiredText(value: unknown, label: string, maximum: number) {
  if (typeof value !== 'string') throw new Error(`${label} is required.`);
  const text = value.trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maximum) throw new Error(`${label} is too long.`);
  return text;
}

function optionalText(value: unknown, maximum: number) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('The support request contains invalid text.');
  const text = value.trim();
  if (!text) return undefined;
  if (text.length > maximum) throw new Error('The support request contains text that is too long.');
  return text;
}

function requiredUuid(value: unknown, label: string) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value.toLowerCase();
}

export function parseNewResidentSupportThread(value: unknown): NewResidentSupportThreadInput {
  if (!value || typeof value !== 'object') throw new Error('The support request is invalid.');
  const input = value as Record<string, unknown>;
  const allowedKeys = new Set([
    'topic',
    'detail',
    'councilProviderId',
    'councilName',
    'clientRequestId',
  ]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    throw new Error('The support request contains an invalid field.');
  }
  if (
    typeof input.topic !== 'string'
    || !residentSupportTopics.includes(input.topic as ResidentSupportTopic)
  ) {
    throw new Error('Choose a valid support topic.');
  }
  const councilProviderId = optionalText(input.councilProviderId, 120);
  const councilName = optionalText(input.councilName, 160);
  if (
    (councilProviderId && (!providerPattern.test(councilProviderId) || !councilName))
    || (!councilProviderId && councilName)
  ) {
    throw new Error('The selected council could not be verified.');
  }
  return {
    topic: input.topic as ResidentSupportTopic,
    detail: requiredText(input.detail, 'Message', 5_000),
    councilProviderId,
    councilName,
    clientRequestId: requiredUuid(input.clientRequestId, 'Message reference'),
  };
}

export function parseResidentSupportReply(value: unknown): ResidentSupportReplyInput {
  if (!value || typeof value !== 'object') throw new Error('The reply is invalid.');
  const input = value as Record<string, unknown>;
  const allowedKeys = new Set(['threadId', 'detail', 'clientMessageId']);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    throw new Error('The reply contains an invalid field.');
  }
  return {
    threadId: requiredUuid(input.threadId, 'Conversation'),
    detail: requiredText(input.detail, 'Reply', 5_000),
    clientMessageId: requiredUuid(input.clientMessageId, 'Message reference'),
  };
}
