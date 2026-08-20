import type { IncorrectDataFeedback } from './types';

export type DataQualityReportPayload = {
  issue: IncorrectDataFeedback['issue'];
  detail: string;
  expectedValue?: string;
  councilProviderId?: string;
  displayedCollectionDate?: string;
  lastVerifiedAt?: string;
  appVersion: string;
  online: boolean;
  clientId: string;
  clientRequestId: string;
};

const ukPostcodePattern = /\b(?:GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))\b/gi;

export function redactDataQualityText(value: string, maximum: number) {
  return value
    .replace(ukPostcodePattern, '[postcode removed]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maximum);
}

export function containsUkPostcode(value: string) {
  ukPostcodePattern.lastIndex = 0;
  return ukPostcodePattern.test(value);
}
