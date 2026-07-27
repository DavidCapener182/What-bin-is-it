-- Resident reach is a core, privacy-minimised service metric and no longer
-- depends on the optional app-improvement analytics choice. Existing rows are
-- retained so installations do not double count when they upgrade; clients
-- migrate their previous anonymous participant UUID into the separate resident
-- installation storage key.
--
-- The historical column name `participant_id` is kept to avoid a breaking
-- database rollout. It now contains the resident installation UUID. No
-- postcode, address, property reference, account or email is accepted.

comment on table public.bin_council_resident_links is
  'Automatic pseudonymous installation-to-council links for aggregate active, current and all-time resident reach. Never stores a postcode, address, property reference, account or email.';

comment on column public.bin_council_resident_links.participant_id is
  'Random resident app installation UUID. Existing analytics participant UUIDs are reused during client migration to prevent double counting.';

comment on column public.bin_council_resident_links.currently_linked is
  'True when the installation most recently reported at least one locally saved place for this council; uninstall cannot be detected.';

comment on column public.bin_council_resident_links.last_seen_at is
  'Last successful resident council-link sync, used for a rolling 30-day active installation definition.';
