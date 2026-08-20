import { defineHandler } from 'nitro';

import {
  apiError,
  apiJson,
  apiRequestBodyErrorResponse,
  apiRequestId,
  apiUnexpectedErrorResponse,
  readBoundedJson,
} from '../../../lib/api-http';
import { binDatabaseConfigured } from '../../../lib/bin-database';
import { parsePartnerConversion, savePartnerConversion } from '../../../lib/partner-conversions';
import { pilotAnalyticsCorsHeaders } from '../../../lib/pilot-analytics-http';

export default defineHandler(async (event) => {
  const requestId = apiRequestId(event.req);
  const headers = pilotAnalyticsCorsHeaders(event.req);
  if (!binDatabaseConfigured()) return apiError(requestId, 503, 'PARTNER_STORAGE_UNAVAILABLE', 'Partner evidence storage is not configured.', headers);
  let input: ReturnType<typeof parsePartnerConversion>;
  try {
    input = parsePartnerConversion(await readBoundedJson(event.req, 2_048));
  } catch (error) {
    return apiRequestBodyErrorResponse(requestId, error, headers)
      ?? apiError(requestId, 400, 'INVALID_PARTNER_EVENT', 'The partner event is invalid.', headers);
  }
  try {
    return apiJson(
      requestId,
      await savePartnerConversion(input),
      { headers },
    );
  } catch (error) {
    return apiUnexpectedErrorResponse(
      requestId,
      '/api/partners/conversion',
      error,
      'Partner evidence storage is temporarily unavailable.',
      503,
      headers,
    );
  }
});
