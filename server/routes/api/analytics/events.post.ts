import { defineHandler } from 'nitro';

import {
  parsePilotAnalyticsBatch,
  pilotAnalyticsConfigured,
  savePilotAnalyticsBatch,
} from '../../../lib/pilot-analytics';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...pilotAnalyticsCorsHeaders(request),
    },
  });
}

export default defineHandler(async (event) => {
  if (!pilotAnalyticsConfigured()) {
    return json(event.req, { error: 'Anonymous app evidence is not configured.' }, 503);
  }
  const contentLength = Number(event.req.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 32_768) {
    return json(event.req, { error: 'The analytics request is too large.' }, 413);
  }
  try {
    const batch = parsePilotAnalyticsBatch(await event.req.json());
    const accepted = await savePilotAnalyticsBatch(batch);
    return json(event.req, { accepted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The analytics request is invalid.';
    const status = /limit has been reached/i.test(message) ? 429 : 400;
    return json(event.req, { error: message }, status);
  }
});
