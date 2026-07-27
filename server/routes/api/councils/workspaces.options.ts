import { defineHandler } from 'nitro';

import { pilotAnalyticsPreflight } from '../../../lib/pilot-analytics-http';

export default defineHandler((event) => pilotAnalyticsPreflight(event.req, 'POST'));
