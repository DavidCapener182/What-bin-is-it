import { defineHandler } from 'nitro';

import {
  buildPilotAnalyticsReport,
  isPilotReportAuthorised,
  pilotAnalyticsConfigured,
  pilotAnalyticsReportCsv,
} from '../../../lib/pilot-analytics';

export default defineHandler(async (event) => {
  if (!pilotAnalyticsConfigured()) {
    return Response.json({ error: 'Pilot evidence is not configured.' }, { status: 503 });
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
        },
      });
    }
    return new Response(JSON.stringify(report), {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'The report could not be generated.',
    }, { status: 400 });
  }
});
