import { defineHandler } from 'nitro';

import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler((event) => new Response(null, {
  status: 204,
  headers: pilotAnalyticsCorsHeaders(event.req),
}));
