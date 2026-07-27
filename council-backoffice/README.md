# What Bin Council Console

This is the private, separately deployed council back office for **What Bin Is It Tonight?** It is not a route, bundle or navigation destination inside the resident Expo/PWA app.

## Product boundary

The console has two deliberately separate levels.

Platform superadmins can:

- see the complete council estate before entering any individual authority;
- enter a selected council portal explicitly;
- manage a relationship CRM for councils, sponsors, partners and enterprise prospects;
- record professional contacts with source, lawful-basis, suppression and retention controls;
- receive resident support messages sent from the What Bin app;
- reply to residents inside the app and close or reopen support threads;
- manage opportunity stages, annual pipeline values and follow-up tasks; and
- keep resident support separate from professional relationship records.

Council staff can:

- review privacy-safe operational metrics;
- publish resident announcements to Home, Schedule and Guide;
- publish disruption advice that residents see before reporting a miss;
- localise recycling guidance without an app release;
- configure missed-collection eligibility and official council handoff;
- submit and independently approve task-relevant partner services;
- export aggregate pilot evidence;
- review an immutable audit trail; and
- manage resident-facing authority identity.

The console does **not** store resident addresses, postcodes, free-text missed-bin reports, IP addresses, user agents or push tokens.

## Relationship CRM and resident inbox

The relationship CRM is a platform-owner workspace, not a resident case-management system and not part of an individual council portal. It stores professional business-contact details only.

The separate Resident inbox is the app's private support channel:

- residents send from Help and support in the web or mobile app;
- platform staff reply in `/crm/messages`;
- replies appear in the resident's in-app conversation;
- threads can be filtered, closed and reopened; and
- support replies and status changes create audit events.

It does not connect Gmail, Outlook or another external mailbox. Support records contain the account reference, message text, timestamps and optional council identifier. They do not copy the resident's saved address, postcode or account email.

All CRM and resident-support tables use the `bin_*` prefix, have RLS enabled, and revoke `anon` and `authenticated` Data API grants. Platform-superadmin checks are repeated in every CRM and inbox page and server mutation.

## Local setup

Copy `.env.example` to `.env.local` and map the approved What Bin Supabase project:

```bash
npm install
npm run verify
npm run dev
```

Use `http://localhost:3010`. A staff user must already exist in Supabase Auth and must be explicitly assigned to an active council tenant.

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
