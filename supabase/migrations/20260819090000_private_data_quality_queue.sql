-- Private first-party queue for resident-submitted data-quality reports.
--
-- The schema deliberately has no postcode, street address, property reference,
-- place label, account, email, IP address or raw installation identifier column.
-- Council identity is derived by the server from the allow-listed provider ID.

create table if not exists public.bin_data_quality_reports (
  id uuid primary key default gen_random_uuid(),
  public_reference varchar(32) not null unique,
  client_request_id uuid not null unique,
  client_id_hash char(64) not null,
  payload_digest char(64) not null,
  organisation_id uuid references public.bin_council_organisations (id) on delete set null,
  council_provider_id varchar(32),
  council_name varchar(160),
  issue varchar(32) not null,
  detail varchar(1000) not null,
  expected_value varchar(500),
  app_version varchar(32) not null,
  displayed_collection_date date,
  last_verified_at timestamptz,
  online boolean not null,
  status varchar(16) not null default 'new',
  expires_at timestamptz not null default (now() + interval '24 months'),
  created_at timestamptz not null default now(),
  constraint bin_data_quality_reports_reference_check
    check (public_reference ~ '^DQ-[0-9]{8}-[0-9A-F]{12}$'),
  constraint bin_data_quality_reports_hash_check
    check (client_id_hash ~ '^[0-9a-f]{64}$'),
  constraint bin_data_quality_reports_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint bin_data_quality_reports_council_check
    check (
      (council_provider_id is null and council_name is null and organisation_id is null)
      or (
        council_provider_id ~ '^lad-[ensw][0-9]{8}$'
        and length(trim(council_name)) between 1 and 160
      )
    ),
  constraint bin_data_quality_reports_issue_check
    check (
      issue in (
        'wrong-date',
        'wrong-bin',
        'missing-collection',
        'address-not-recognised',
        'wrong-council',
        'guide-problem',
        'service-problem',
        'other'
      )
    ),
  constraint bin_data_quality_reports_detail_check
    check (length(trim(detail)) between 1 and 1000),
  constraint bin_data_quality_reports_expected_check
    check (expected_value is null or length(trim(expected_value)) between 1 and 500),
  constraint bin_data_quality_reports_version_check
    check (app_version ~ '^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$'),
  constraint bin_data_quality_reports_status_check
    check (status in ('new', 'reviewed', 'resolved', 'dismissed')),
  constraint bin_data_quality_reports_expiry_check
    check (expires_at > created_at)
);

create index if not exists bin_data_quality_reports_client_rate_idx
  on public.bin_data_quality_reports (client_id_hash, created_at desc);
create index if not exists bin_data_quality_reports_tenant_queue_idx
  on public.bin_data_quality_reports (
    organisation_id,
    council_provider_id,
    created_at desc,
    public_reference desc
  );
create index if not exists bin_data_quality_reports_tenant_status_queue_idx
  on public.bin_data_quality_reports (
    organisation_id,
    council_provider_id,
    status,
    created_at desc,
    public_reference desc
  );
create index if not exists bin_data_quality_reports_platform_queue_idx
  on public.bin_data_quality_reports (created_at desc, public_reference desc);
create index if not exists bin_data_quality_reports_platform_status_queue_idx
  on public.bin_data_quality_reports (status, created_at desc, public_reference desc);
create index if not exists bin_data_quality_reports_expiry_idx
  on public.bin_data_quality_reports (expires_at);

alter table public.bin_data_quality_reports enable row level security;
revoke all on table public.bin_data_quality_reports from anon, authenticated;

create or replace function public.bin_purge_expired_data_quality_reports()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.bin_data_quality_reports
  where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.bin_purge_expired_data_quality_reports()
  from public, anon, authenticated;

comment on table public.bin_data_quality_reports is
  'Private server-only data-quality queue. Expires after 24 months and contains no address, postcode, property reference, place label, account, email, IP address or raw installation identifier.';
comment on column public.bin_data_quality_reports.client_id_hash is
  'One-way SHA-256 hash of a dedicated random data-quality client ID, used only for durable abuse-rate enforcement and never reused by another feature.';
comment on column public.bin_data_quality_reports.payload_digest is
  'SHA-256 digest of the canonical validated report fields, used to reject changed payloads that reuse an idempotency key.';
comment on column public.bin_data_quality_reports.expires_at is
  'Hard retention deadline; the private maintenance job must delete rows when this time is reached.';
