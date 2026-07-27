import { defineHandler } from 'nitro';

import {
  parsePilotCouncilLinkSync,
  pilotAnalyticsConfigured,
  syncPilotCouncilLinks,
} from '../../../lib/pilot-analytics';

const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export default defineHandler(async (event) => {
  if (!pilotAnalyticsConfigured()) {
    return json({ error: 'Anonymous app evidence is not configured.' }, 503);
  }
  const contentLength = Number(event.req.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    return json({ error: 'The council link update is too large.' }, 413);
  }
  try {
    const result = await syncPilotCouncilLinks(
      parsePilotCouncilLinkSync(await event.req.json()),
    );
    return json(result);
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : 'The council link update is invalid.',
    }, 400);
  }
});
