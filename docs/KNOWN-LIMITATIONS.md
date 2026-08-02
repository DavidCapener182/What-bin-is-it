# Known limitations

- Directory routing covers 361 UK local-authority districts, but live schedule coverage is published separately and is not UK-wide.
- Most directory adapters remain experimental until controlled-address and operational verification are complete.
- Knowsley missed reporting currently uses the official council handoff. The resident confirms the returned council reference/status before the app stores it.
- Saved places and reminder preferences are device-local; signing in restores plan access, not the address itself. Opt-in household sharing coordinates a nickname, members and bin actions but deliberately does not upload or restore the council property reference.
- Account removal deletes What Bin records but not the shared Supabase authentication identity.
- The first Apple release is iPhone-only. iPad support is disabled pending adaptive-layout testing.
- Predictive Back is enabled but still requires physical Android regression testing across sheets, account, address, guide and external-return flows.
- Native widgets require an installed native build; a PWA cannot appear in the iOS or Android widget gallery.
- Billing code is present but production payment prompts remain disabled until Apple/Google enrolment, products and sandbox validation are complete.
- Native remote council-alert delivery, provider receipt reconciliation, widget/Live Activity refresh, Android collection-status delivery, deep links, magic-link return, upgrade preservation and offline startup still require the documented physical-device release pass. Push-provider acceptance is recorded but is not represented as proof that a handset displayed the alert.
- Council-local recycling guidance is configuration-driven where a profile exists; otherwise the app labels general guidance and directs the resident to check locally.
- Area-targeted alerts depend on an approved council source providing non-address round or ward labels. Without that feed, the console permits only council-wide or collection/date targeting and warns the publisher before sending.
- The bulky marketplace is operationally ready but will show no paid provider until that council enables bulky booking and approves a real partner. In-app payment additionally requires the provider to complete Stripe Connect onboarding and production webhook validation.
- External partner booking confirmation currently requires an authorised council-console user to record the provider's confirmation reference. Website opens, calls, directions and booking starts are reported only as their actual interaction type and never as revenue.
- Native bulky-checkout return still needs a physical-device deep-link pass. The production PWA returns directly to the booking status screen; native builds may return through the hosted status page until store deep links are approved.
