# Council Console Architecture Contract

This document is the boundary between the operational console that exists now and backend contracts that do not. The console must never create demonstration rows, infer a live state from missing monitoring, or label a prerequisite as complete.

## Current application shape

- Next.js 16 App Router server pages authenticate through `requireCouncilSession` or `requirePlatformAdminSession` before loading operational data.
- Council queries and writes carry the authenticated organisation identifier or council provider identifier. Platform-wide views require the explicit platform-admin record.
- `OperationalQueue` owns semantic captions, URL filters, server-compatible sorting, pagination links, saved device views and the narrow-screen row alternative.
- `OperationalDrawer` owns focused authoring and record review. Mutating server actions retain their existing permission, tenant-confirmation and audit requirements.
- High-volume audit, support, announcement, disruption, partner, booking, demand, CRM and council-estate lists use count-backed server pagination. Adding a new queue must not reintroduce a fixed snapshot `LIMIT` as its only navigation mechanism.
- `OperationalReadiness` is the presentation contract for missing prerequisites. `unavailable`, `partial` and `prerequisite-required` are product states, not operational records.

## Missing backend contracts

These names are proposed contracts for design and migration review. They are not present production state and are not created by this console tranche.

| Capability | Required persistent contract | Required server API or job | Console state until delivered |
| --- | --- | --- | --- |
| Staff invitations and role lifecycle | `bin_council_staff_invitations`, role-change history and invitation expiry | Tenant-scoped invite, accept, resend, suspend and role-change actions | Unavailable in Settings and Governance |
| Selected staff-session revocation | A staff-visible session inventory keyed to council membership without exposing unrelated shared-product sessions | List and revoke a selected console session; audited break-glass recovery | Unavailable in Settings |
| Content versioning and four-eyes approval | `bin_council_content_versions`, `bin_council_approval_decisions` | Create version, assign approver, approve/reject, publish an immutable approved version | Current publish confirmation remains partial |
| Retention and legal holds | `bin_council_retention_policies`, `bin_council_legal_holds`, `bin_council_retention_jobs` | Dry-run, execute, reconcile and evidence retention jobs | Unavailable in Governance and Settings |
| Audit correlation and evidence export | First-class `request_id`/`correlation_id` on audit rows plus an export manifest | Paginated signed audit export with completion evidence | Searchable audit is partial |
| Partner insurance and assurance | `bin_partner_assurance_reviews`, evidence expiry and automatic-review decisions | Upload-reference metadata, review, suspend and renew workflows | Partner queue displays only fields actually stored |
| Marketplace disputes and payout reconciliation | `bin_marketplace_disputes`, `bin_marketplace_payout_reconciliations` | Provider-ledger reconciliation, dispute evidence and authorised resolution actions | Booking queue does not imply complete finance reconciliation |
| Direct missed-report submission | Council-specific endpoint contract, idempotency key, acknowledgement and server-only secret reference | Validated submit, retry, reconcile and resident-safe status actions | Official handoff only |
| Governed metric definitions and comparisons | `bin_council_metric_definitions`, instrumentation version and comparison cohorts | Versioned metric query and evidence-export manifest | Previous-period claims unavailable |
| Platform monitoring and incident communications | `bin_platform_monitor_checks`, incident updates and subscriber delivery evidence | Health ingestion, incident update lifecycle, subscriber send/reconciliation | Recorded incidents never imply uptime |

## Queue implementation rules

1. Parse only allow-listed status, filter, sort, direction and page-size values.
2. Apply the authenticated tenant predicate in both the count and row query. A platform-admin query must be intentionally platform-wide.
3. Count the complete matching set, clamp the requested page, then apply deterministic ordering with a stable identifier tie-breaker.
4. Keep page size bounded. Do not silently cap the complete matching count or facet list.
5. Preserve the current view in sort, pagination, saved-view and row-detail links.
6. Show a table caption and labelled mobile cells. A card alternative must expose the same values and actions.
7. Fetch row-related evidence only for the authorised current page unless a separate aggregate is explicitly required.

## Test-only fixture boundary

Browser fixtures may exercise the shared queue and drawer only when both conditions are true: `NODE_ENV` is not `production` and `COUNCIL_E2E_FIXTURES=1`. Production must return `notFound()` for the fixture route. Fixture records must be visibly labelled as test data and must never be written to council tables.
