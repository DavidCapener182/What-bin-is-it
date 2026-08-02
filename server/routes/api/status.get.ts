import { defineHandler } from 'nitro';

import { publicPlatformStatus } from '../../lib/public-status';

export default defineHandler(async () => new Response(JSON.stringify(await publicPlatformStatus()), {
  status: 200,
  headers: {
    'cache-control': 'public, max-age=60, stale-while-revalidate=300',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  },
}));
