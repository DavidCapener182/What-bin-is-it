# Council pilot success measures

Agree the baseline, numerator, denominator, data owner and reporting frequency before launch. Do not claim impact from app activity alone.

## Core measures

| Measure | Definition | Source |
| --- | --- | --- |
| Exact-address lookup completion | Successful exact-property selections / valid postcode attempts | Privacy-preserving app events |
| Verified-date availability | Addresses receiving at least one non-estimated dated collection / selected addresses | Gateway source checks |
| Source accuracy | Council-validated dates matching the app / sampled dated collections | Joint sample audit |
| Reminder opt-in | Places with reminders enabled / places with verified dates | On-device aggregate only if agreed |
| Missed-bin route completion | Opened official route / eligible guided attempts | App route event; council completion only if council returns it |
| Failed lookup rate | Failed or unsupported lookups / valid lookup attempts | Gateway health events |
| Service availability | Successful gateway checks / total checks | Gateway monitoring |
| Avoidable contact change | Comparable waste-information contacts during pilot versus agreed baseline | Council contact-centre data |

## Guardrails

- Do not collect full street addresses for analytics.
- Do not use postcode-level reporting where a small count could identify a household.
- Suppress or aggregate small cohorts using a threshold agreed in the DPIA.
- Keep operational gateway logs separate from product analytics.
- A click to an official report page is not a submitted report.
- A local app tracking reference is not a council CRM reference.
- Separate correlation from causation when contact volumes change.

## Pilot acceptance

Before controlled release:

- the test-address set passes exact-property and collection-date checks;
- every displayed date is sourced and non-estimated;
- a source outage produces an honest unavailable or cached state;
- no credential appears in the mobile bundle;
- privacy, support and data-source pages are public;
- reminder delivery is tested on physical iOS and Android devices;
- council content and reporting links are signed off.

At pilot close, provide:

- the agreed measure table;
- known gaps and unsupported addresses;
- source incidents and recovery times;
- support themes;
- recommendation and cost for the next phase;
- deletion or return of council-supplied test data according to the agreement.
