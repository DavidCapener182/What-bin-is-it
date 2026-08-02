# What Bin Council Console

This is the private, separately deployed council back office for **What Bin Is It Tonight?** It is not a route, bundle or navigation destination inside the resident Expo/PWA app.

## Product boundary

The console has two deliberately separate levels.

Platform superadmins can:

- see the complete council estate before entering any individual authority;
- enter a selected council portal explicitly;
- switch between Commercial, Operations and Governance workspaces instead of navigating one undifferentiated sidebar;
- manage a relationship CRM for councils, sponsors, partners and enterprise prospects;
- record professional contacts with source, lawful-basis, suppression and retention controls;
- manage the council-demand funnel created by privacy-safe resident reach and deduplicated connection requests;
- receive and oversee resident support cases sent from the What Bin app;
- monitor connector health, platform incidents, sponsorship programmes and cross-council outcome evidence;
- manage opportunity stages, annual pipeline values and follow-up tasks; and
- keep resident support separate from professional relationship records.

Council staff can:

- review privacy-safe operational metrics;
- publish resident announcements to Today, Schedule, Guide and Activity;
- publish disruption advice that residents see before reporting a miss;
- target operational messages by collection type, scheduled date or an approved opaque round/ward label, with a privacy-safe audience estimate;
- preview the exact Today, Schedule, Guide, Activity and push presentation before confirming a send;
- optionally send the same verified announcement or disruption by push to matching opted-in registrations belonging only to that council;
- localise recycling guidance without an app release;
- configure missed-collection eligibility and official council handoff;
- manage resident cases with assignment, priority, SLA deadline, internal notes, tags, saved responses, escalation and satisfaction evidence;
- submit, independently approve and immediately suspend task-relevant partner campaigns;
- record only evidence-based partner interactions, with confirmed bookings requiring referral or callback proof;
- configure a visual onboarding checklist and resident-facing feature flags;
- provide time-bounded council- or housing-sponsored Plus access;
- export aggregate outcome funnels and pilot evidence against an explicit baseline;
- review an immutable audit trail; and
- manage resident-facing authority identity.

The console does **not** display or query resident addresses, postcodes, free-text missed-bin reports, IP addresses, user agents or push credentials. Private delivery credentials stay behind the resident app server boundary; the console sees only aggregate provider-acceptance and failure counts for its own broadcast jobs.

## Relationship CRM and resident inbox

The relationship CRM is a platform-owner workspace, not a resident case-management system and not part of an individual council portal. It stores professional business-contact details only.

The separate Resident inbox is the app's lightweight, tenant-scoped case-management channel:

- residents send from Help and support in the web or mobile app;
- council staff reply in `/crm/messages` only to conversations tagged to their own authority;
- platform superadmins use the same route for the complete cross-council inbox, including unassigned conversations;
- replies appear in the resident's Activity/support conversation;
- cases can be assigned and given a priority, SLA deadline, topic tags and escalation state;
- internal notes remain staff-only and saved responses can accelerate common replies;
- threads can be filtered, resolved, closed, reopened and rated by the resident; and
- support replies and status changes create audit events.

It does not connect Gmail, Outlook or another external mailbox. Support records contain the account reference, message text, timestamps and optional council identifier plus the case-management fields described above. They do not copy the resident's saved address, postcode or account email.

## Privacy-safe audiences and sponsored access

Resident push registrations may contain only a random installation identifier, council provider identifiers, bounded collection types and dates, and approved opaque audience labels. The console never receives an address, postcode, property reference, account identity or private notification token. Targeted messages require a previewed audience estimate and an explicit confirmation. Whole-council sends are labelled clearly before publishing.

Council-sponsored Plus is a server-authoritative entitlement linked to the currently selected council. A programme has a sponsor type, resident-facing label, included feature list, start/end window and renewal date. The resident paywall is suppressed only while a matching programme is active. Moving the selected place recalculates access; it does not copy the place into an account.

## Platform data model

The consolidation adds only `bin_*` tables and columns for council feature flags, sponsorship programmes, platform incidents, household coordination, partner conversion evidence, support case fields and targeted audiences. All new tables have RLS enabled and revoke direct `anon` and `authenticated` Data API access. Server actions repeat council scope and role checks inside database transactions.

All CRM and resident-support tables use the `bin_*` prefix, have RLS enabled, and revoke `anon` and `authenticated` Data API grants. Commercial CRM pages remain platform-superadmin-only. Resident inbox list, thread, reply and status mutations repeat the signed-in council scope on the server; only platform superadmins receive an unscoped view.

## Local setup

Copy `.env.example` to `.env.local` and map the approved What Bin Supabase project:

```bash
npm install
npm run verify
npm run dev
```

Use `http://localhost:3010`. When the resident app workspace already has an approved root `.env.local`, the development launcher reuses `BIN_DATABASE_URL` and maps its `EXPO_PUBLIC_SUPABASE_*` variables into the console process without copying secrets into another file. Console-specific development sign-in variables remain in `council-backoffice/.env.local`.

A staff user must already exist in Supabase Auth and must be explicitly assigned to an active council tenant.

## Provision staff safely

First run without `--apply`:

```bash
npm run staff:bootstrap -- \
  --provider lad-e00000000 \
  --slug example \
  --council "Example Council" \
  --email person@example.gov.uk \
  --role owner
```

After checking the exact council, account and role, repeat with `--apply`. The script never guesses an organisation from an email domain and cannot create an Auth user.

Platform-wide access is a separate, explicit assignment:

```bash
npm run platform-admin:bootstrap -- --email person@example.gov.uk
```

Run it once without `--apply`, verify the exact existing Auth account, then repeat with `--apply`. A platform superadmin first lands on the global platform overview. Council content and operational tools stay hidden until the superadmin deliberately selects **Enter council portal**. Inside that selected tenant the platform superadmin receives owner-level permissions. No email domain or user metadata grants this access.

## Deployment

Deploy this directory as its own Vercel project with Root Directory set to `council-backoffice`. Do not add its URL to resident navigation. Required environment variables are listed in `.env.example`.

The app sets `noindex`, restrictive security headers and a per-request CSP nonce. Authorisation is always re-checked server-side from `bin_council_staff`; user metadata is not trusted.
