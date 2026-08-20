import { councilDatabase } from "./database";
import { dataQualityDateOnly } from "./data-quality-date";
import {
  decodeDataQualityReportCursor,
  encodeDataQualityReportCursor,
  type DataQualityReportStatus,
} from "./data-quality-pagination";
import type { CouncilStaffSession } from "./types";

const dataQualityPageSize = 50;

type DataQualityReportRow = {
  public_reference: string;
  council_provider_id: string | null;
  council_name: string | null;
  issue: string;
  detail: string;
  expected_value: string | null;
  app_version: string;
  displayed_collection_date: string | Date | null;
  last_verified_at: Date | null;
  online: boolean;
  status: string;
  expires_at: Date;
  created_at: Date;
};

function publicReport(row: DataQualityReportRow) {
  return {
    trackingReference: row.public_reference,
    councilProviderId: row.council_provider_id ?? undefined,
    councilName: row.council_name ?? undefined,
    issue: row.issue,
    detail: row.detail,
    expectedValue: row.expected_value ?? undefined,
    appVersion: row.app_version,
    displayedCollectionDate: dataQualityDateOnly(row.displayed_collection_date),
    lastVerifiedAt: row.last_verified_at?.toISOString(),
    online: row.online,
    status: row.status,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

export async function listDataQualityReports(
  session: CouncilStaffSession,
  options: { cursor?: string; status?: DataQualityReportStatus } = {},
) {
  const sql = councilDatabase();
  const cursor = decodeDataQualityReportCursor(options.cursor);
  const scopeFilter = session.platformAdmin
    ? sql``
    : sql`
        AND organisation_id = ${session.organisation.id}::uuid
        AND council_provider_id = ${session.organisation.providerId}
      `;
  const statusFilter = options.status ? sql`AND status = ${options.status}` : sql``;
  const cursorFilter = cursor
    ? sql`
        AND (created_at, public_reference) < (
          ${cursor.createdAt}::timestamptz,
          ${cursor.trackingReference}
        )
      `
    : sql``;
  const rows = await sql<DataQualityReportRow[]>`
    SELECT
      public_reference,
      council_provider_id,
      council_name,
      issue,
      detail,
      expected_value,
      app_version,
      displayed_collection_date,
      last_verified_at,
      online,
      status,
      expires_at,
      created_at
    FROM bin_data_quality_reports
    WHERE expires_at > now()
    ${scopeFilter}
    ${statusFilter}
    ${cursorFilter}
    ORDER BY created_at DESC, public_reference DESC
    LIMIT ${dataQualityPageSize + 1}
  `;
  const hasNextPage = rows.length > dataQualityPageSize;
  const pageRows = hasNextPage ? rows.slice(0, dataQualityPageSize) : rows;
  const lastRow = pageRows.at(-1);
  return {
    reports: pageRows.map(publicReport),
    nextCursor: hasNextPage && lastRow
      ? encodeDataQualityReportCursor({
          createdAt: lastRow.created_at.toISOString(),
          trackingReference: lastRow.public_reference,
        })
      : undefined,
  };
}
