function safeDiagnostic(value: unknown, fallback: string) {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value)
    ? value
    : fallback;
}

export function logAccountRouteFailure({
  requestId,
  route,
  error,
}: {
  requestId: string;
  route: 'account-delete' | 'account-export' | 'account-re-enrol';
  error: unknown;
}) {
  const errorName = error instanceof Error
    ? safeDiagnostic(error.name, 'Error')
    : 'UnknownError';
  const candidateCode = error && typeof error === 'object'
    ? Reflect.get(error, 'code')
    : undefined;
  console.error(JSON.stringify({
    event: 'account-route-failure',
    requestId,
    route,
    errorName,
    ...(typeof candidateCode === 'string'
      ? { errorCode: safeDiagnostic(candidateCode, 'UNCLASSIFIED') }
      : {}),
  }));
}
