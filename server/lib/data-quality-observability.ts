type DataQualityStorageFailureLog = {
  requestId: string;
  route: '/api/data-quality/reports';
  errorName: string;
  errorCode?: string;
};

function safeDiagnosticLabel(value: unknown, fallback: string) {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(value)
    ? value
    : fallback;
}

export function dataQualityStorageFailureLog(
  error: unknown,
  requestId: string,
): DataQualityStorageFailureLog {
  let errorName: unknown;
  let errorCode: unknown;
  try {
    if (error && typeof error === 'object') {
      errorName = (error as { name?: unknown }).name;
      errorCode = (error as { code?: unknown }).code;
    }
  } catch {
    // Hostile error objects must not break the stable failure response.
  }
  const entry: DataQualityStorageFailureLog = {
    requestId,
    route: '/api/data-quality/reports',
    errorName: safeDiagnosticLabel(errorName, 'UnknownError'),
  };
  if (typeof errorCode === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(errorCode)) {
    entry.errorCode = errorCode;
  }
  return entry;
}
