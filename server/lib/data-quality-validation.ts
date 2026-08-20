import { findCouncilByProviderId } from '../../src/lib/council-directory.ts';
import { containsUkPostcode } from '../../src/lib/data-quality-report.ts';
import type { DataQualityReportPayload } from '../../src/lib/data-quality-report.ts';
import { ApiRequestBodyError, readBoundedJson } from './api-http.ts';

export const dataQualityIssues = [
  'wrong-date',
  'wrong-bin',
  'missing-collection',
  'address-not-recognised',
  'wrong-council',
  'guide-problem',
  'service-problem',
  'other',
] as const;

export type ValidatedDataQualityReport = DataQualityReportPayload & {
  councilName?: string;
};

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providerPattern = /^lad-[ensw]\d{8}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const appVersionPattern = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$/;
const allowedKeys = new Set<keyof DataQualityReportPayload>([
  'issue',
  'detail',
  'expectedValue',
  'councilProviderId',
  'displayedCollectionDate',
  'lastVerifiedAt',
  'appVersion',
  'online',
  'clientId',
  'clientRequestId',
]);

function requiredText(value: unknown, label: string, maximum: number) {
  if (typeof value !== 'string') throw new Error(`${label} is required.`);
  const text = value.trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maximum) throw new Error(`${label} is too long.`);
  if (containsUkPostcode(text)) throw new Error(`${label} must not include a postcode.`);
  return text;
}

function optionalText(value: unknown, label: string, maximum: number) {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredText(value, label, maximum);
}

function requiredUuidV4(value: unknown, label: string) {
  if (typeof value !== 'string' || !uuidV4Pattern.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value.toLowerCase();
}

function optionalDate(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !datePattern.test(value)) {
    throw new Error('The displayed collection date is invalid.');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('The displayed collection date is invalid.');
  }
  return value;
}

function optionalTimestamp(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 40) {
    throw new Error('The verification time is invalid.');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('The verification time is invalid.');
  return parsed.toISOString();
}

export function parseDataQualityReport(value: unknown): ValidatedDataQualityReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The data-quality report is invalid.');
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !allowedKeys.has(key as keyof DataQualityReportPayload))) {
    throw new Error('The data-quality report contains an invalid field.');
  }
  if (
    typeof input.issue !== 'string'
    || !dataQualityIssues.includes(input.issue as (typeof dataQualityIssues)[number])
  ) {
    throw new Error('Choose a valid data-quality issue.');
  }
  if (typeof input.appVersion !== 'string' || !appVersionPattern.test(input.appVersion)) {
    throw new Error('The app version is invalid.');
  }
  if (typeof input.online !== 'boolean') throw new Error('The network state is invalid.');

  const councilProviderId = optionalText(input.councilProviderId, 'Council provider', 32);
  const council = councilProviderId && providerPattern.test(councilProviderId)
    ? findCouncilByProviderId(councilProviderId)
    : undefined;
  if (councilProviderId && !council) throw new Error('The selected council could not be verified.');

  return {
    issue: input.issue as DataQualityReportPayload['issue'],
    detail: requiredText(input.detail, 'Report detail', 1_000),
    expectedValue: optionalText(input.expectedValue, 'Expected value', 500),
    councilProviderId,
    councilName: council?.name,
    displayedCollectionDate: optionalDate(input.displayedCollectionDate),
    lastVerifiedAt: optionalTimestamp(input.lastVerifiedAt),
    appVersion: input.appVersion,
    online: input.online,
    clientId: requiredUuidV4(input.clientId, 'Client reference'),
    clientRequestId: requiredUuidV4(input.clientRequestId, 'Request reference'),
  };
}

export class DataQualityPayloadTooLargeError extends Error {}

export async function readBoundedDataQualityJson(request: Request, maximumBytes = 8_192) {
  try {
    return await readBoundedJson(request, maximumBytes);
  } catch (error) {
    if (error instanceof ApiRequestBodyError && error.code === 'REQUEST_BODY_TOO_LARGE') {
      throw new DataQualityPayloadTooLargeError('The data-quality report is too large.');
    }
    throw error;
  }
}
