# What Bin Council Console

This is the private, separately deployed council back office for **What Bin Is It Tonight?** It is not a route, bundle or navigation destination inside the resident Expo/PWA app.

## Product boundary

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

Run it once without `--apply`, verify the exact existing Auth account, then repeat with `--apply`. A platform superadmin can switch across every active council tenant and receives owner-level permissions inside the selected tenant. No email domain or user metadata grants this access.

## Deployment

Deploy this directory as its own Vercel project with Root Directory set to `council-backoffice`. Do not add its URL to resident navigation. Required environment variables are listed in `.env.example`.

The app sets `noindex`, restrictive security headers and a per-request CSP nonce. Authorisation is always re-checked server-side from `bin_council_staff`; user metadata is not trusted.
