# Council resident-engagement platform

## Service model

The resident remains the user; the council can become the customer. Essential resident functions stay free:

- verified collection dates;
- reminders;
- local recycling answers;
- council service updates; and
- the official missed-collection route.

The council licence funds a private operational workspace, localised content, evidence, integration support and approved messaging.

## Three strict trust rules

1. Council and free services are listed before commercial services.
2. Commercial results appear only when they solve the item or service task already in progress.
3. Every paid or referred result carries an explicit disclosure such as `Sponsored partner`.

No feed, coupon wall, behavioural ad profile or sale of resident location data is part of the platform.

## Architecture

```text
Platform owner
    |
    v
Private Platform Console (separate Vercel deployment)
    |
    +-- Commercial workspace: CRM, pipeline, demand, sponsorship
    +-- Operations workspace: councils, support, alerts, incidents
    +-- Governance workspace: staff, permissions, audit, retention
    +-- explicit "Enter council portal" boundary
    |
    v
Selected Council Portal
    |
    +-- server-verified Supabase Auth identity
    +-- bin_council_staff tenant role
    +-- bin_council_* operational tables
    +-- immutable audit row on every council mutation
    |
    v
Council gateway (published, time-bounded records only)
    |
    +-- resident Today / Schedule / Guide / Activity
    +-- local guidance and reporting policy
    +-- approved partner results after official options
    |
    v
Resident app (address and report detail remain on device)
```

The resident app never receives database credentials and cannot discover or navigate to the private console.

## Platform relationship CRM boundary

The CRM exists above all council tenants so the platform owner can track commercial and delivery relationships across the complete estate. It is intentionally separate from council resident operations.

It can store:

- council, sponsor, partner and enterprise organisations;
- named professional contacts and work contact details;
- lawful basis, contact source, suppression and retention-review controls;
- sent, received and internal correspondence;
- calls, meetings, proposals and outcome notes;
- pipeline stage, annual opportunity value and follow-up tasks; and
- provider-neutral message and thread identifiers for future secure Gmail or Outlook synchronisation.

It must not store resident addresses, missed-bin case detail, sensitive personal data or personal contact lists. Automatic mailbox capture is only declared active after real OAuth connection, secure token storage, historical-sync controls and deletion/retention behaviour are implemented and tested.

## Council content lifecycle

`draft -> published -> archived`

Partner campaigns use an additional approval boundary:

`draft -> review -> active -> paused/ended`

An editor can submit a partner, but only an owner or admin can activate it.

Every campaign also has an area, guide-item relevance, time window, disclosure, commercial model, evidence-review date and immediate suspension control. Free council and reuse routes retain priority. Listing views and outbound actions are distinct from a confirmed referral; the latter requires partner callback or referral proof.

## Honest channel readiness

Today, Schedule, Guide and Activity publishing is connected. Before publishing, council staff see surface and push previews, truncation/source/expiry/duplicate warnings, an estimated recipient count and a final audience confirmation. The console can queue a tenant-scoped web/native push broadcast for the same announcement or disruption. The resident service selects only current, consented registrations whose council provider ID and bounded collection type/date/approved opaque label match the audience. Provider acceptance and failure counts are recorded; the console does not claim that acceptance proves a handset displayed the message.

Council onboarding is explicit rather than inferred. The console checks identity, staff access, collection source, address lookup, bin labels/colours, guidance, missed-bin policy, alerts, partner approvals and pilot baseline. Per-council flags hide unsupported resident actions rather than presenting controls that cannot complete.

Web delivery is operational when production VAPID credentials and the shared server-only broadcast secret are configured. Native delivery uses Expo push tickets and still requires Apple/Google notification credentials plus physical-device delivery, revocation and receipt testing before a store-release claim. Widget broadcasts are not yet live. Each council must agree content governance, emergency escalation and who is authorised to publish.

## Expansion path

The same tenant, permission and audit model can later support damaged bins, replacement bins, bulky waste, fly-tipping, clinical waste and wider environmental reporting. Each resident service should be introduced as a separate approved workflow. The platform relationship CRM must remain bounded to professional commercial correspondence and must never become a resident case-data store.
