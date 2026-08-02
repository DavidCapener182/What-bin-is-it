import { defineHandler } from 'nitro';

import { parseCouncilDemandRequest, saveCouncilDemandRequest } from '../../../lib/council-demand';
import { binDatabaseConfigured } from '../../../lib/bin-database';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const headers = {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...pilotAnalyticsCorsHeaders(event.req),
  };
  if (!binDatabaseConfigured()) return new Response(JSON.stringify({ error: 'Council request storage is not configured.' }), { status: 503, headers });
  const contentLength = Number(event.req.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 2_048) {
    return new Response(JSON.stringify({ error: 'The council request is too large.' }), { status: 413, headers });
  }
  try {
    return new Response(JSON.stringify(await saveCouncilDemandRequest(
      parseCouncilDemandRequest(await event.req.json()),
    )), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'The council request is invalid.',
    }), { status: 400, headers });
  }
});
