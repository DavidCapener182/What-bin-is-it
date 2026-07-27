import { defineHandler } from 'nitro';

import { requireBinAccount } from '../../../lib/bin-auth';
import {
  parseResidentSupportReply,
  replyToResidentSupportThread,
} from '../../../lib/resident-support';

export default defineHandler(async (event) => {
  const contentLength = Number(event.req.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return Response.json({ error: 'The reply is too large.' }, { status: 413 });
  }
  let user;
  try {
    user = await requireBinAccount(event.req);
  } catch {
    return Response.json({ error: 'Sign in to reply to support.' }, {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    });
  }
  let input;
  try {
    input = parseResidentSupportReply(await event.req.json());
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'The reply is invalid.',
    }, {
      status: 400,
      headers: { 'cache-control': 'no-store' },
    });
  }
  try {
    return Response.json({
      threads: await replyToResidentSupportThread(user, input),
    }, {
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return Response.json({
      error: 'Your reply could not be sent. Try again shortly.',
    }, {
      status: 500,
      headers: { 'cache-control': 'no-store' },
    });
  }
});
