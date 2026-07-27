import { defineHandler } from 'nitro';

import {
  councilBroadcastAuthorised,
  parseCouncilBroadcastRequest,
  processCouncilBroadcast,
} from '../../../../lib/council-alert-push';

export default defineHandler(async (event) => {
  if (!councilBroadcastAuthorised(event.req.headers.get('authorization'))) {
    return Response.json({ error: 'The council broadcast request was not authorised.' }, {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    });
  }
  try {
    const { jobId } = parseCouncilBroadcastRequest(await event.req.json());
    return Response.json(await processCouncilBroadcast(jobId), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'The council broadcast could not be processed.',
    }, {
      status: 400,
      headers: { 'cache-control': 'no-store' },
    });
  }
});
