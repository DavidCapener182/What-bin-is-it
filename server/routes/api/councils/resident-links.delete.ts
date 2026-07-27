import { defineHandler } from 'nitro';

import {
  deleteResidentCouncilInstallation,
  isPilotParticipantId,
  pilotAnalyticsConfigured,
} from '../../../lib/pilot-analytics';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};

export default defineHandler(async (event) => {
  const headers = {
    ...jsonHeaders,
    ...pilotAnalyticsCorsHeaders(event.req),
  };
  if (!pilotAnalyticsConfigured()) {
    return new Response(JSON.stringify({ error: 'Resident council storage is not configured.' }), {
      status: 503,
      headers,
    });
  }
  try {
    const body = await event.req.json() as { installationId?: unknown };
    if (!isPilotParticipantId(body.installationId)) {
      return new Response(JSON.stringify({ error: 'The resident installation ID is invalid.' }), {
        status: 400,
        headers,
      });
    }
    const deleted = await deleteResidentCouncilInstallation(body.installationId);
    return new Response(JSON.stringify({ deleted }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'The deletion request is invalid.' }), {
      status: 400,
      headers,
    });
  }
});
