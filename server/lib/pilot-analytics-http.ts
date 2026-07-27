const canonicalAppOrigin = 'https://what-bin-is-it-tonight.vercel.app';
const localDevelopmentOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}$/;
const whatBinVercelOrigin = /^https:\/\/what-bin-is-it-tonight(?:-[a-z0-9-]+)?\.vercel\.app$/;

export function isAllowedPilotAnalyticsOrigin(origin: string | null) {
  if (!origin) return true;
  return (
    origin === canonicalAppOrigin
    || localDevelopmentOrigin.test(origin)
    || whatBinVercelOrigin.test(origin)
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

export function pilotAnalyticsPreflight(request: Request, method: 'POST' | 'DELETE') {
  const origin = request.headers.get('origin');
  if (!origin || !isAllowedPilotAnalyticsOrigin(origin)) {
    return new Response(null, {
      status: 403,
      headers: { 'cache-control': 'no-store' },
    });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': `${method}, OPTIONS`,
      'access-control-allow-origin': origin,
      'access-control-max-age': '600',
      'cache-control': 'no-store',
      vary: 'Origin',
    },
  });
}
