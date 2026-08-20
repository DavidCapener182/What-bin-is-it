import { randomUUID } from 'node:crypto';

import { defineHandler } from 'nitro';

import {
  ACCOUNT_DATA_REMOVAL_CONFIRMATION,
  AccountDataRemovalError,
  accountDataRemovalFailure,
  removeResidentAccountData,
} from '../../../lib/account-deletion';
import { logAccountRouteFailure } from '../../../lib/account-observability';
import {
  BinAccountAuthenticationError,
  requireBinAccount,
} from '../../../lib/bin-auth';

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
    if (event.req.headers.get('x-bin-confirm-delete') !== ACCOUNT_DATA_REMOVAL_CONFIRMATION) {
      return Response.json({
        removed: false,
        identityRetained: true,
        code: 'ACCOUNT_DATA_REMOVAL_NOT_CONFIRMED',
        errorCode: 'ACCOUNT_DATA_REMOVAL_NOT_CONFIRMED',
        error: 'What Bin account-data removal was not confirmed.',
        guidance: 'Return to the account screen and use its removal confirmation.',
        retryable: false,
        requestId,
      }, { status: 400, headers: responseHeaders(requestId) });
    }

    const result = await removeResidentAccountData({
      userId: user.id,
      sessionId: user.sessionId,
      authenticationMethods: user.authenticationMethods,
    });
    return Response.json({ ...result, requestId }, { headers: responseHeaders(requestId) });
  } catch (error) {
    if (error instanceof BinAccountAuthenticationError) {
      return Response.json({
        removed: false,
        identityRetained: true,
        code: error.code,
        errorCode: error.code,
        error: error.message,
        guidance: error.status === 401
          ? 'Sign in with a fresh email link, then try again.'
          : 'Please try again later or contact What Bin support.',
        retryable: error.status === 503,
        requestId,
      }, { status: error.status, headers: responseHeaders(requestId) });
    }
    if (!(error instanceof AccountDataRemovalError)) {
      logAccountRouteFailure({ requestId, route: 'account-delete', error });
    }
    const failure = accountDataRemovalFailure(error);
    return Response.json({ ...failure.body, errorCode: failure.body.code, requestId }, {
      status: failure.status,
      headers: responseHeaders(requestId),
    });
  }
});
