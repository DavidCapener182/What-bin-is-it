# Private data-quality queue

Incorrect-information reports are sent to `POST /api/data-quality/reports`. The resident must review the exact JSON payload before it is sent. The endpoint accepts only the allow-listed fields shown in that preview and rejects unknown fields, invalid council IDs, postcode-shaped text, malformed dates and IDs, overlong values, non-JSON input and bodies over 8 KiB.

## Data boundary

The request and `bin_data_quality_reports` schema have no postcode, street address, property reference, place label, account, email or IP-address field. The resident client sends only the public council provider ID; the server verifies that ID against the bundled council directory and derives the council name. A dedicated random data-quality client ID is stored under its own client-only key and is never reused for council reach, analytics, accounts or another feature. Its raw value is immediately SHA-256 hashed before database storage and is used only for abuse-rate enforcement. Direct Supabase Data API access is blocked by RLS plus revoked `anon` and `authenticated` grants.

Council-console reads require the existing `support:view` permission. Non-platform staff queries bind both the authenticated organisation UUID and its provider ID. A platform superadmin can inspect the cross-council queue. The page is read-only and never selects the installation hash.

## Application rate limit

Database advisory locking makes the client limit durable and race-safe: at most five new reports per dedicated client hash in 15 minutes and 20 in 24 hours. Replaying the same request ID returns its original tracking reference without consuming another allowance.

Before parsing a report, the Nitro route also derives an HMAC-SHA256 key from Vercel's overwritten, single-valued `x-forwarded-for` address and applies a durable 120-per-15-minute network budget. The database stores only that scoped HMAC output, never the IP address. Malformed/multi-valued forwarding headers and unavailable database controls fail closed with HTTP 503; exhaustion returns HTTP 429 with `Retry-After`. A caller-supplied `cf-connecting-ip` header is ignored on Vercel.

The client budget still limits a single installation when many residents share a carrier or council network; the more generous network budget constrains rotation without starting at an overly restrictive shared-NAT limit. Hosting WAF, device reputation and bot filtering remain optional defence in depth and should be tuned from privacy-safe telemetry rather than represented as already configured.

## Retention

Each row receives an `expires_at` deadline 24 months after submission. Console queries exclude expired rows. The reviewed release migration schedules `bin_purge_expired_data_quality_reports()` daily through `pg_cron`; production operations must read back the active named job and alert if its executions stop or fail. The function is revoked from public, `anon` and `authenticated` roles.
