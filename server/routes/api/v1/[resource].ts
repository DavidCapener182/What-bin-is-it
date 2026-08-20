import { defineHandler } from 'nitro';
import * as Crypto from 'node:crypto';

import { createCouncilGateway } from '../../../../api/_gateway/index.ts';
import { serverGatewaySecurityControls } from '../../../lib/gateway-security-controls';
import { pilotAnalyticsConfigured, recordPilotGatewayCheck } from '../../../lib/pilot-analytics';

const providerPattern = /^lad-[ensw]\d{8}$/;
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const gateway = createCouncilGateway(serverGatewaySecurityControls);

function providerFromRequest(request: Request) {
  const url = new URL(request.url);
  const queryProvider = url.searchParams.get('providerId');
  if (queryProvider && providerPattern.test(queryProvider)) return queryProvider;
  return undefined;
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
  const queryProviderId = providerFromRequest(request);
  const response = await gateway.fetch(event.req);
  const responseProviderId = response.headers.get('x-council-provider-id');
  const responseRequestId = response.headers.get('x-request-id');
  const requestId = responseRequestId && requestIdPattern.test(responseRequestId)
    ? responseRequestId
    : Crypto.randomUUID();
  const providerId = responseProviderId && providerPattern.test(responseProviderId)
    ? responseProviderId
    : queryProviderId;
  if (pilotAnalyticsConfigured()) {
    // Gateway availability is authoritative; best-effort analytics must never
    // consume the remaining serverless response budget after a slow provider.
    void recordPilotGatewayCheck({
      id: requestId,
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
