import { apiError, apiNoContent, apiRequestId } from './api-http.ts';

const canonicalAppOrigin = 'https://what-bin-is-it-tonight.vercel.app';
const localDevelopmentOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}$/;

export function isAllowedPilotAnalyticsOrigin(origin: string | null) {
  if (!origin) return true;
  return (
    origin === canonicalAppOrigin
    || localDevelopmentOrigin.test(origin)
  );
}

export function pilotAnalyticsCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || !isAllowedPilotAnalyticsOrigin(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    vary: 'Origin',
  };
}

export function pilotAnalyticsPreflight(request: Request, method: 'POST' | 'DELETE' | 'POST, DELETE') {
  const requestId = apiRequestId(request);
  const origin = request.headers.get('origin');
  if (!origin || !isAllowedPilotAnalyticsOrigin(origin)) {
    return apiError(requestId, 403, 'ORIGIN_NOT_ALLOWED', 'Origin not accepted.');
  }
  return apiNoContent(requestId, 204, {
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': `${method}, OPTIONS`,
      'access-control-allow-origin': origin,
      'access-control-max-age': '600',
      'cache-control': 'no-store',
      vary: 'Origin',
  });
}
