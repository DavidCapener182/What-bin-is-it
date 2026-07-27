-- Privacy-preserving resident adoption totals by waste collection authority.
--
-- The resident client sends only:
--   * its random, opt-in analytics participant UUID; and
--   * the council provider IDs represented by its current saved places.
--
-- No postcode, address, UPRN, coordinates, account ID, email address, device
-- token, search text or report narrative is stored. Rows are retained when a
-- place is removed so councils can evidence all-time reach. A resident's
-- explicit "erase anonymous app evidence" request deletes these rows.

create table if not exists public.bin_council_resident_links (
  participant_id uuid not null,
  council_id varchar(80) not null,
  first_linked_at timestamptz not null default now(),
  last_linked_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  currently_linked boolean not null default true,
  unlinked_at timestamptz,
  primary key (participant_id, council_id),
  constraint bin_council_resident_links_council_check
    check (council_id ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  constraint bin_council_resident_links_unlinked_check
    check (
      (currently_linked and unlinked_at is null)
      or (not currently_linked and unlinked_at is not null)
    )
);

create index if not exists bin_council_resident_links_council_current_idx
  on public.bin_council_resident_links (council_id, currently_linked, last_seen_at);

create index if not exists bin_council_resident_links_council_first_idx
  on public.bin_council_resident_links (council_id, first_linked_at);

alter table public.bin_council_resident_links enable row level security;

revoke all on table public.bin_council_resident_links from anon, authenticated;

comment on table public.bin_council_resident_links is
  'Opt-in pseudonymous installation-to-council links for aggregate active, current and all-time resident reach. Never stores a postcode or address.';

comment on column public.bin_council_resident_links.currently_linked is
  'True when the installation most recently reported at least one locally saved place for this council; uninstall cannot be detected.';

comment on column public.bin_council_resident_links.last_seen_at is
  'Last successful consented link-state sync, used for a rolling 30-day active installation definition.';
