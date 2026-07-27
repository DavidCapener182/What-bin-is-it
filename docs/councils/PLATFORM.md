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
Council staff
    |
    v
Private Council Console (separate Vercel deployment)
    |
    +-- server-side Supabase Auth claims
    +-- bin_council_staff tenant role
    +-- bin_council_* operational tables
    +-- immutable audit row on every mutation
    |
    v
Council gateway (published, time-bounded records only)
    |
    +-- resident Home / Schedule / Guide
    +-- local guidance and reporting policy
    +-- approved partner results after official options
    |
    v
Resident app (address and report detail remain on device)
```

The resident app never receives database credentials and cannot discover or navigate to the private console.

## Council content lifecycle

`draft -> published -> archived`

Partner services use an additional approval boundary:

`draft -> review -> active -> paused/ended`

An editor can submit a partner, but only an owner or admin can activate it.

## Honest channel readiness

Home, Schedule and Guide publishing is connected. Remote push and widget broadcast tables exist as an aggregate job boundary, but the console does not claim those channels are live until:

- resident consent registrations have a reviewed retention policy;
- Apple, Google and web-push credentials are approved;
- physical-device delivery and revocation are tested; and
- the council agrees content governance and emergency escalation.

## Expansion path

The same tenant, permission and audit model can later support damaged bins, replacement bins, bulky waste, fly-tipping, clinical waste and wider environmental reporting. Each service should be introduced as a separate approved workflow, not as an unbounded generic CRM.
