import { defineHandler } from 'nitro';

import {
  parseCouncilAlertRegistration,
  syncCouncilAlertRegistration,
} from '../../../lib/council-alert-push';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...pilotAnalyticsCorsHeaders(request) },
  });
}

export default defineHandler(async (event) => {
  const contentLength = Number(event.req.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 8_192) {
    return json(event.req, { error: 'The notification registration is too large.' }, 413);
  }
  try {
    const registration = parseCouncilAlertRegistration(await event.req.json());
    const result = await syncCouncilAlertRegistration(registration);
    return json(event.req, result);
  } catch (error) {
    return json(event.req, {
      error: error instanceof Error ? error.message : 'The notification registration is invalid.',
    }, 400);
  }
});
