# Council assurance and procurement answers

This is a truthful pilot-stage statement, not a certification. Update it whenever infrastructure, processors, accounts, analytics or payment handling changes.

## Service status

| Area | Current position |
| --- | --- |
| Product | Resident iOS, Android and installable web app |
| Hosting | Vercel production web and gateway deployment |
| Source code | Version controlled in GitHub |
| Collection data | Exact dated results only; no generated runtime schedules |
| Resident account | None in the current free release |
| Address storage | Device-local saved places and schedules |
| Server request | Postcode, provider ID and opaque property reference when a lookup is requested |
| Location | Foreground, user-initiated, used to find a postcode; no background tracking |
| Advertising | None |
| Address-data sale | Prohibited by product policy |
| Payments | Disabled during the proof release |
| Certifications | No ISO 27001, Cyber Essentials or SOC certification is claimed |
| Formal accessibility audit | Not yet commissioned; engineering target is WCAG 2.2 AA and native platform semantics |
| Contract SLA | Not yet offered; define for an Integrated contract |

## Data flow

1. A resident enters a postcode or asks for one-time foreground location.
2. Postcodes.io resolves the postcode and ONS authority code.
3. The resident selects the exact property where the source requires it.
4. The app sends postcode, provider ID and opaque property reference to the gateway.
5. The gateway calls the approved council or nationwide source.
6. The app stores returned dates and preferences on the device.
7. Native reminders are scheduled locally. The installed web app stores a browser push subscription and server-side reminder delivery plan when the user enables web notifications.

The gateway code does not persist full addresses. Infrastructure access logs and processor behavior must be covered by the production retention schedule and DPA.

## Roles to agree

The controller/processor position depends on the integration:

- for the independent public resident app, the operator determines app purposes and is normally controller for any data it retains;
- for council-branded reporting or council-instructed analytics, the contract must identify the council’s controller role and the app operator’s processor or joint-controller responsibilities;
- a missed-bin handoff to a council website is separate from direct CRM submission;
- direct CRM reporting must not launch until the DPA, lawful basis, privacy notice, retention and subject-rights process are agreed.

Obtain legal and information-governance review; this repository is not legal advice.

## Data minimization

- Use an opaque property reference after selection.
- Do not include a full address in reminder payloads.
- Do not collect continuous or background location.
- Do not use advertising identifiers.
- Do not create resident accounts for the first free release.
- Do not collect council analytics by full address.
- Aggregate or suppress small geographic cohorts.
- Separate operational security logs from product measures.

## Retention proposal for a pilot

Agree exact periods in the DPIA and contract:

- gateway operational logs: shortest period needed for incident investigation;
- connector health and aggregate measures: pilot term plus agreed close-out period;
- council-supplied test-address set: delete at acceptance or pilot close;
- enquiry and procurement contacts: retain while the opportunity is active, then review;
- resident device data: resident controls it through address removal or **Clear all app data**;
- web push subscription: remove when notifications are disabled or the subscription expires;
- direct report records: not in scope until council CRM integration is contracted.

## Security controls in the current code

- HTTPS-only council partner endpoints;
- redirects rejected for partner requests;
- credentials referenced by server environment-variable name and never returned to the app;
- strict provider identity and response validation;
- 15-second upstream timeout;
- bounded public error messages;
- exact-property requirement where the source is property-specific;
- secrets excluded from Git;
- automated TypeScript, lint, gateway, source-parser and packaging tests;
- separate preview and production build profiles.

Before a council production contract:

- document access control and least privilege for GitHub, Vercel, Expo, Apple and Google;
- enable enforced MFA and recovery ownership;
- record subprocessors and data locations;
- document backup and restoration for any new server database;
- add dependency and secret scanning in CI;
- commission penetration testing proportionate to direct-reporting scope;
- publish incident contacts and an incident response runbook;
- agree vulnerability handling and notification times;
- complete disaster recovery and service-level tests.

## DPIA prompts

- What identifiable or household-linked data is necessary?
- Can the purpose be met with an opaque property reference?
- Who can access connector logs?
- Does the council need property-level analytics, and why?
- What is the re-identification risk in small cohorts?
- What happens when a tenancy changes?
- How are subject access, correction, objection and deletion handled?
- Which subprocessors receive data and in which country?
- What is the impact of an incorrect collection date or failed report handoff?
- How is human support available for inaccessible or incorrect information?

## Accessibility

The app uses platform text, labelled controls, semantic routes, keyboard tab patterns on web, system appearance and high-contrast light/dark palettes. Before a council-branded release:

- test with VoiceOver, TalkBack, keyboard and 200% text;
- test error states and address selection;
- test reduced motion and reduced transparency;
- validate WCAG 2.2 AA on the production web route;
- publish an accessibility statement with known limitations and a response route;
- confirm Welsh and other language requirements for the service area.

## Procurement evidence available in the repository

- architecture and data-source description;
- normalized partner integration contract;
- automated tests;
- public privacy, terms, support and data-source routes;
- app-store privacy declarations;
- council pilot measures;
- commercial packages and onboarding boundary;
- 361-authority targeting pipeline with honest source status.

## Items requiring a named owner before a pilot

- legal entity and contracting address;
- partnership, privacy and incident email addresses;
- data-protection lead;
- security lead;
- support hours;
- processor list and retention schedule;
- insurance;
- council content owner;
- commercial terms, VAT position and invoice process;
- escalation and exit plan.
