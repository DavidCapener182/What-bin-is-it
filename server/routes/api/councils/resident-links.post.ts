import { defineHandler } from 'nitro';

import {
  parseResidentCouncilLinkSync,
  pilotAnalyticsConfigured,
  syncResidentCouncilLinks,
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
    return json(event.req, { error: 'Resident council storage is not configured.' }, 503);
  }
  const contentLength = Number(event.req.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    return json(event.req, { error: 'The resident council update is too large.' }, 413);
  }
  try {
    const result = await syncResidentCouncilLinks(
      parseResidentCouncilLinkSync(await event.req.json()),
    );
    return json(event.req, result);
  } catch (error) {
    return json(event.req, {
      error: error instanceof Error ? error.message : 'The resident council update is invalid.',
    }, 400);
  }
});
