import { defineHandler } from 'nitro';
import * as Crypto from 'node:crypto';

import gateway from '../../../../api/_gateway/index.ts';
import { pilotAnalyticsConfigured, recordPilotGatewayCheck } from '../../../lib/pilot-analytics';

const providerPattern = /^lad-[ensw]\d{8}$/;

async function providerFromRequest(request: Request, resource: string) {
  const url = new URL(request.url);
  const queryProvider = url.searchParams.get('providerId');
  if (queryProvider && providerPattern.test(queryProvider)) return queryProvider;
  if (resource !== 'collections' || request.method !== 'POST') return undefined;
  try {
    const body = await request.clone().json() as { providerId?: unknown };
    return typeof body.providerId === 'string' && providerPattern.test(body.providerId)
      ? body.providerId
      : undefined;
  } catch {
    return undefined;
  }
}

export default defineHandler(async (event) => {
  const started = Date.now();
  const request = event.req;
  const resourceName = new URL(request.url).pathname.split('/').filter(Boolean).at(-1) ?? 'unknown';
  const resource = (
    resourceName === 'addresses'
    || resourceName === 'collections'
    || resourceName === 'services'
  ) ? resourceName : 'unknown';
  const providerId = await providerFromRequest(request, resource);
  const response = await gateway.fetch(event.req);
  if (pilotAnalyticsConfigured()) {
    await recordPilotGatewayCheck({
      id: Crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      councilId: providerId,
      resource,
      successful: response.ok,
      statusCode: response.status,
      durationMs: Math.min(120_000, Date.now() - started),
      reasonCode: response.ok
        ? undefined
        : response.status >= 500
          ? 'source-error'
          : response.status >= 400
            ? 'client-error'
            : 'unknown',
    }).catch(() => undefined);
  }
  return response;
});
