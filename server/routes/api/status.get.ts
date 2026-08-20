import { defineHandler } from 'nitro';

import { apiJson, apiRequestId, apiUnexpectedErrorResponse } from '../../lib/api-http';
import { publicPlatformStatus } from '../../lib/public-status';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  try {
    return apiJson(requestId, await publicPlatformStatus(), {
      headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    return apiUnexpectedErrorResponse(requestId, '/api/status', error, 'Platform status is temporarily unavailable.', 503);
  }
});
