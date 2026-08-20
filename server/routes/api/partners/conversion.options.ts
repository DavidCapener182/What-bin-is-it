import { defineHandler } from 'nitro';

import { apiNoContent, apiRequestId } from '../../../lib/api-http';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler((event) => apiNoContent(
  apiRequestId(event.req),
  204,
  pilotAnalyticsCorsHeaders(event.req),
));
