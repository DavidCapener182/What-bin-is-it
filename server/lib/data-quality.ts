import { createHash, randomBytes } from 'node:crypto';
import type postgres from 'postgres';

import { binDatabase } from './bin-database';
import {
  dataQualityPayloadDigest,
  dataQualityReplayMatches,
} from './data-quality-idempotency';
import type { ValidatedDataQualityReport } from './data-quality-validation';

type StoredReportRow = {
  public_reference: string;
  created_at: Date;
  client_id_hash: string;
  payload_digest: string;
};

type RateWindowRow = {
  short_count: number;
  daily_count: number;
  oldest_short: Date | null;
  oldest_daily: Date | null;
  database_now: Date;
};

export class DataQualityRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Too many data-quality reports were sent from this data-quality client.');
    this.name = 'DataQualityRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class DataQualityRequestConflictError extends Error {}

function clientIdHash(clientId: string) {
  return createHash('sha256').update(clientId).digest('hex');
}

function trackingReference(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `DQ-${date}-${randomBytes(6).toString('hex').toUpperCase()}`;
}

function publicReport(row: StoredReportRow, created: boolean) {
  return {
    trackingReference: row.public_reference,
    submittedAt: row.created_at.toISOString(),
    created,
  };
}

function retryAfterSeconds(start: Date | null, windowMilliseconds: number, now: Date) {
  if (!start) return 60;
  return Math.max(1, Math.ceil((start.getTime() + windowMilliseconds - now.getTime()) / 1_000));
}

async function existingReport(
  sql: postgres.TransactionSql,
  input: ValidatedDataQualityReport,
  hash: string,
  digest: string,
) {
  const rows = await sql<StoredReportRow[]>`
    SELECT public_reference, created_at, client_id_hash, payload_digest
    FROM bin_data_quality_reports
    WHERE client_request_id = ${input.clientRequestId}::uuid
    LIMIT 1
  `;
  const existing = rows[0];
  if (existing && !dataQualityReplayMatches(
    {
      clientIdHash: existing.client_id_hash,
      payloadDigest: existing.payload_digest,
    },
    {
      clientIdHash: hash,
      payloadDigest: digest,
    },
  )) {
    throw new DataQualityRequestConflictError('That request reference is already in use.');
  }
  return existing;
}

export async function saveDataQualityReport(input: ValidatedDataQualityReport) {
  const sql = binDatabase();
  const hash = clientIdHash(input.clientId);
  const digest = dataQualityPayloadDigest(input);
  return sql.begin(async (transaction) => {
    const lockKeys = [
      `client:${hash}`,
      `request:${input.clientRequestId}`,
    ].sort();
    for (const lockKey of lockKeys) {
      await transaction`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
      `;
    }

    const existing = await existingReport(transaction, input, hash, digest);
    if (existing) return publicReport(existing, false);

    const rateRows = await transaction<RateWindowRow[]>`
      SELECT
        count(*) FILTER (WHERE created_at > now() - interval '15 minutes')::int AS short_count,
        count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS daily_count,
        min(created_at) FILTER (WHERE created_at > now() - interval '15 minutes') AS oldest_short,
        min(created_at) FILTER (WHERE created_at > now() - interval '24 hours') AS oldest_daily,
        now() AS database_now
      FROM bin_data_quality_reports
      WHERE client_id_hash = ${hash}
        AND created_at > now() - interval '24 hours'
    `;
    const rate = rateRows[0];
    if (rate?.short_count >= 5) {
      throw new DataQualityRateLimitError(retryAfterSeconds(rate.oldest_short, 15 * 60_000, rate.database_now));
    }
    if (rate?.daily_count >= 20) {
      throw new DataQualityRateLimitError(retryAfterSeconds(rate.oldest_daily, 24 * 60 * 60_000, rate.database_now));
    }

    const rows = await transaction<StoredReportRow[]>`
      INSERT INTO bin_data_quality_reports (
        public_reference,
        client_request_id,
        client_id_hash,
        payload_digest,
        organisation_id,
        council_provider_id,
        council_name,
        issue,
        detail,
        expected_value,
        app_version,
        displayed_collection_date,
        last_verified_at,
        online
      ) VALUES (
        ${trackingReference()},
        ${input.clientRequestId}::uuid,
        ${hash},
        ${digest},
        (
          SELECT organisation.id
          FROM bin_council_organisations AS organisation
          WHERE organisation.provider_id = ${input.councilProviderId ?? null}
          LIMIT 1
        ),
        ${input.councilProviderId ?? null},
        ${input.councilName ?? null},
        ${input.issue},
        ${input.detail},
        ${input.expectedValue ?? null},
        ${input.appVersion},
        ${input.displayedCollectionDate ?? null}::date,
        ${input.lastVerifiedAt ?? null}::timestamptz,
        ${input.online}
      )
      RETURNING public_reference, created_at, client_id_hash, payload_digest
    `;
    const inserted = rows[0];
    if (!inserted) throw new Error('The data-quality report could not be stored.');
    return publicReport(inserted, true);
  });
}

export {
  DataQualityPayloadTooLargeError,
  parseDataQualityReport,
  readBoundedDataQualityJson,
} from './data-quality-validation';
