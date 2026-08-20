export const dataQualityReportStatuses = [
  "new",
  "reviewed",
  "resolved",
  "dismissed",
] as const;

export type DataQualityReportStatus = typeof dataQualityReportStatuses[number];

export type DataQualityReportCursor = {
  createdAt: string;
  trackingReference: string;
};

const referencePattern = /^DQ-[0-9]{8}-[0-9A-F]{12}$/;
const encodedCursorPattern = /^[0-9A-Za-z_-]{1,256}$/;

export function dataQualityReportStatus(value: unknown): DataQualityReportStatus | undefined {
  return typeof value === "string"
    && dataQualityReportStatuses.includes(value as DataQualityReportStatus)
    ? value as DataQualityReportStatus
    : undefined;
}

export function encodeDataQualityReportCursor(cursor: DataQualityReportCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeDataQualityReportCursor(value: unknown): DataQualityReportCursor | undefined {
  if (typeof value !== "string" || !encodedCursorPattern.test(value)) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return undefined;
    const candidate = decoded as Record<string, unknown>;
    if (
      typeof candidate.createdAt !== "string"
      || typeof candidate.trackingReference !== "string"
      || !referencePattern.test(candidate.trackingReference)
    ) return undefined;
    const createdAt = new Date(candidate.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== candidate.createdAt) {
      return undefined;
    }
    return {
      createdAt: candidate.createdAt,
      trackingReference: candidate.trackingReference,
    };
  } catch {
    return undefined;
  }
}
