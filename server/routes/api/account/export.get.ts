import { randomUUID } from 'node:crypto';

import { defineHandler } from 'nitro';

import {
  BinAccountAuthenticationError,
  requireBinAccount,
} from '../../../lib/bin-auth';
import { exportResidentAccountRecords } from '../../../lib/account-export';
import { logAccountRouteFailure } from '../../../lib/account-observability';

function responseHeaders(requestId: string, attachment = false) {
  return {
    'cache-control': 'no-store',
    ...(attachment
      ? { 'content-disposition': 'attachment; filename="what-bin-account-export.json"' }
      : {}),
    'x-content-type-options': 'nosniff',
    'x-request-id': requestId,
  };
}

export default defineHandler(async (event) => {
  const requestId = randomUUID();
  try {
    const user = await requireBinAccount(event.req);
    const records = await exportResidentAccountRecords(user.id);
    return Response.json({
      requestId,
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      savedAddresses: 'Stored only on the resident device and not included in the account export.',
      ...records,
    }, {
      headers: responseHeaders(requestId, true),
    });
  } catch (error) {
    if (error instanceof BinAccountAuthenticationError) {
      return Response.json({
        code: error.code,
        errorCode: error.code,
        error: error.message,
        guidance: error.status === 401
          ? 'Sign in with a fresh email link, then try the export again.'
          : 'Please try again later or contact What Bin support.',
        retryable: error.status === 503,
        requestId,
      }, { status: error.status, headers: responseHeaders(requestId) });
    }
    logAccountRouteFailure({ requestId, route: 'account-export', error });
    return Response.json({
      code: 'ACCOUNT_EXPORT_UNAVAILABLE',
      errorCode: 'ACCOUNT_EXPORT_UNAVAILABLE',
      error: 'Your What Bin account export could not be created right now.',
      guidance: 'Please try again later. If the problem continues, contact What Bin support.',
      retryable: true,
      requestId,
    }, {
      status: 503,
      headers: responseHeaders(requestId),
    });
  }
});
