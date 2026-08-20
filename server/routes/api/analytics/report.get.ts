import { defineHandler } from 'nitro';

import { apiError, apiJson, apiRequestId, logApiFailure } from '../../../lib/api-http';
import {
  buildPilotAnalyticsReport,
  isPilotReportAuthorised,
  pilotAnalyticsConfigured,
  pilotAnalyticsReportCsv,
} from '../../../lib/pilot-analytics';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  if (!pilotAnalyticsConfigured()) {
    return apiError(requestId, 503, 'ANALYTICS_UNAVAILABLE', 'Pilot evidence is not configured.');
  }
  const url = new URL(event.req.url);
  const councilId = url.searchParams.get('councilId') ?? undefined;
  const period = Number(url.searchParams.get('days') ?? 84);
  const privileged = isPilotReportAuthorised(event.req.headers.get('authorization'));
  try {
    const report = await buildPilotAnalyticsReport({
      councilId,
      periodDays: Number.isFinite(period) ? period : 84,
      privileged,
    });
    if (url.searchParams.get('format') === 'csv') {
      return new Response(pilotAnalyticsReportCsv(report), {
        status: 200,
        headers: {
          'cache-control': 'no-store',
          'content-disposition': 'attachment; filename="what-bin-pilot-evidence.csv"',
          'content-type': 'text/csv; charset=utf-8',
          'x-content-type-options': 'nosniff',
          'x-request-id': requestId,
        },
      });
    }
    return apiJson(requestId, report);
  } catch (error) {
    logApiFailure(requestId, '/api/analytics/report', error);
    return apiError(requestId, 400, 'INVALID_REPORT_REQUEST', 'The report could not be generated.');
  }
});
