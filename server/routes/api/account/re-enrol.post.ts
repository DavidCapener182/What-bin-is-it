import { randomUUID } from 'node:crypto';

import { defineHandler } from 'nitro';

import {
  BinAccountAuthenticationError,
  requireBinAccount,
} from '../../../lib/bin-auth';
import { logAccountRouteFailure } from '../../../lib/account-observability';
import { recordWhatBinReEnrolmentIntent } from '../../../lib/entitlement-reconciliation';

export const WHAT_BIN_RE_ENROLMENT_INTENT = 'plus-purchase-or-restore';

function responseHeaders(requestId: string) {
  return {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-request-id': requestId,
  };
}

export default defineHandler(async (event) => {
  const requestId = randomUUID();
  try {
    const user = await requireBinAccount(event.req);
    if (event.req.headers.get('x-bin-confirm-re-enrol') !== WHAT_BIN_RE_ENROLMENT_INTENT) {
      return Response.json({
        code: 'WHAT_BIN_RE_ENROLMENT_NOT_CONFIRMED',
        errorCode: 'WHAT_BIN_RE_ENROLMENT_NOT_CONFIRMED',
        error: 'What Bin re-enrolment was not confirmed.',
        retryable: false,
        requestId,
      }, { status: 400, headers: responseHeaders(requestId) });
    }
    const suppressionPending = await recordWhatBinReEnrolmentIntent(user.id, 'native');
    return Response.json({
      intentRecorded: true,
      suppressionPending,
      requestId,
    }, { headers: responseHeaders(requestId) });
  } catch (error) {
    if (error instanceof BinAccountAuthenticationError) {
      return Response.json({
        code: error.code,
        errorCode: error.code,
        error: error.message,
        retryable: error.status === 503,
        requestId,
      }, { status: error.status, headers: responseHeaders(requestId) });
    }
    logAccountRouteFailure({ requestId, route: 'account-re-enrol', error });
    return Response.json({
      code: 'WHAT_BIN_RE_ENROLMENT_UNAVAILABLE',
      errorCode: 'WHAT_BIN_RE_ENROLMENT_UNAVAILABLE',
      error: 'What Bin re-enrolment could not be prepared right now.',
      retryable: true,
      requestId,
    }, { status: 503, headers: responseHeaders(requestId) });
  }
});
