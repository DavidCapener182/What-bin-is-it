import { defineHandler } from 'nitro';

import { apiError, apiJson, apiRequestId, logApiFailure } from '../../../lib/api-http';
import { binDatabaseConfigured } from '../../../lib/bin-database';
import { dataQualityStorageFailureLog } from '../../../lib/data-quality-observability';
import {
  DataQualityPayloadTooLargeError,
  DataQualityRateLimitError,
  DataQualityRequestConflictError,
  parseDataQualityReport,
  readBoundedDataQualityJson,
  saveDataQualityReport,
} from '../../../lib/data-quality';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';
import { consumeServerApiRateLimit } from '../../../lib/gateway-security-controls';

function errorResponse(
  request: Request,
  requestId: string,
  status: number,
  code: string,
  message: string,
  extraHeaders: Record<string, string> = {},
) {
  return apiError(requestId, status, code, message, {
    ...pilotAnalyticsCorsHeaders(request),
    ...extraHeaders,
  });
}

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  if (!binDatabaseConfigured()) {
    return errorResponse(
      event.req,
      requestId,
      503,
      'DATA_QUALITY_STORAGE_UNAVAILABLE',
      'Data-quality report storage is not configured.',
    );
  }

  try {
    const networkRate = await consumeServerApiRateLimit(event.req, {
      scope: 'data-quality-network',
      limit: 120,
      windowSeconds: 15 * 60,
    });
    if (!networkRate.allowed) {
      return errorResponse(
        event.req,
        requestId,
        429,
        'DATA_QUALITY_NETWORK_RATE_LIMITED',
        'Too many data-quality reports were sent from this network. Try again later.',
        { 'retry-after': String(networkRate.retryAfterSeconds) },
      );
    }
  } catch (error) {
    logApiFailure(requestId, '/api/data-quality/reports:abuse-control', error);
    return errorResponse(
      event.req,
      requestId,
      503,
      'DATA_QUALITY_ABUSE_CONTROL_UNAVAILABLE',
      'Data-quality reporting is temporarily unavailable.',
    );
  }

  let input;
  try {
    input = parseDataQualityReport(await readBoundedDataQualityJson(event.req));
  } catch (error) {
    const tooLarge = error instanceof DataQualityPayloadTooLargeError;
    return errorResponse(
      event.req,
      requestId,
      tooLarge ? 413 : 400,
      tooLarge ? 'DATA_QUALITY_PAYLOAD_TOO_LARGE' : 'DATA_QUALITY_INVALID_REPORT',
      tooLarge
        ? 'The data-quality report is too large.'
        : 'The data-quality report is invalid.',
    );
  }

  try {
    const result = await saveDataQualityReport(input);
    return apiJson(requestId, {
      trackingReference: result.trackingReference,
      submittedAt: result.submittedAt,
      requestId,
      clientRequestId: input.clientRequestId,
    }, {
      status: result.created ? 201 : 200,
      headers: pilotAnalyticsCorsHeaders(event.req),
    });
  } catch (error) {
    if (error instanceof DataQualityRateLimitError) {
      return errorResponse(
        event.req,
        requestId,
        429,
        'DATA_QUALITY_RATE_LIMITED',
        error.message,
        {
          'retry-after': String(error.retryAfterSeconds),
        },
      );
    }
    if (error instanceof DataQualityRequestConflictError) {
      return errorResponse(
        event.req,
        requestId,
        409,
        'DATA_QUALITY_REQUEST_CONFLICT',
        error.message,
      );
    }
    console.error(JSON.stringify(dataQualityStorageFailureLog(error, requestId)));
    return errorResponse(
      event.req,
      requestId,
      500,
      'DATA_QUALITY_STORAGE_FAILED',
      'The data-quality report could not be sent. Try again shortly.',
    );
  }
});
