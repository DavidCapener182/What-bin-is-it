import { defineHandler } from 'nitro';

import {
  deletePilotParticipant,
  isPilotParticipantId,
  pilotAnalyticsConfigured,
} from '../../../lib/pilot-analytics';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

const headers = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};

export default defineHandler(async (event) => {
  const responseHeaders = {
    ...headers,
    ...pilotAnalyticsCorsHeaders(event.req),
  };
  if (!pilotAnalyticsConfigured()) {
    return new Response(JSON.stringify({ error: 'Anonymous app evidence is not configured.' }), {
      status: 503,
      headers: responseHeaders,
    });
  }
  try {
    const body = await event.req.json() as { participantId?: unknown };
    if (!isPilotParticipantId(body.participantId)) {
      return new Response(JSON.stringify({ error: 'The analytics participant ID is invalid.' }), {
        status: 400,
        headers: responseHeaders,
      });
    }
    const deleted = await deletePilotParticipant(body.participantId);
    return new Response(JSON.stringify({ deleted }), { status: 200, headers: responseHeaders });
  } catch {
    return new Response(JSON.stringify({ error: 'The deletion request is invalid.' }), {
      status: 400,
      headers: responseHeaders,
    });
  }
});
