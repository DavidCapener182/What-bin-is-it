import { defineHandler } from 'nitro';

import {
  deletePilotParticipant,
  isPilotParticipantId,
  pilotAnalyticsConfigured,
} from '../../../lib/pilot-analytics';

const headers = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};

export default defineHandler(async (event) => {
  if (!pilotAnalyticsConfigured()) {
    return new Response(JSON.stringify({ error: 'Anonymous app evidence is not configured.' }), {
      status: 503,
      headers,
    });
  }
  try {
    const body = await event.req.json() as { participantId?: unknown };
    if (!isPilotParticipantId(body.participantId)) {
      return new Response(JSON.stringify({ error: 'The analytics participant ID is invalid.' }), {
        status: 400,
        headers,
      });
    }
    const deleted = await deletePilotParticipant(body.participantId);
    return new Response(JSON.stringify({ deleted }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'The deletion request is invalid.' }), {
      status: 400,
      headers,
    });
  }
});
