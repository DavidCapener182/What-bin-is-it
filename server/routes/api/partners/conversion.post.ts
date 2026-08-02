import { defineHandler } from 'nitro';

import { binDatabaseConfigured } from '../../../lib/bin-database';
import { parsePartnerConversion, savePartnerConversion } from '../../../lib/partner-conversions';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const headers = {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...pilotAnalyticsCorsHeaders(event.req),
  };
  if (!binDatabaseConfigured()) return new Response(JSON.stringify({ error: 'Partner evidence storage is not configured.' }), { status: 503, headers });
  const contentLength = Number(event.req.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 2_048) {
    return new Response(JSON.stringify({ error: 'The partner event is too large.' }), { status: 413, headers });
  }
  try {
    return new Response(JSON.stringify(await savePartnerConversion(parsePartnerConversion(await event.req.json()))), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'The partner event is invalid.' }), { status: 400, headers });
  }
});
