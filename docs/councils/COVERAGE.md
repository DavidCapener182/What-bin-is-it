# Council coverage

The 361-authority directory provides postcode-to-authority routing. It is not a claim that 361 live collection feeds exist.

## Published status levels

| Status | Meaning |
| --- | --- |
| `live-direct` | Exact property and non-estimated dates are verified end to end against a named live source. |
| `partner-connected` | An approved council/contractor feed is configured and monitored. |
| `public-feed` | A stable public authority feed is connected and monitored. |
| `experimental-adapter` | A source adapter exists but is not yet a production coverage claim. |
| `council-link-only` | The app can route the resident to an official council service but cannot show dates. |
| `unsupported` | No safe source or official route is available. |

Capabilities are labelled independently: addresses, collections, guidance, services, alerts and missed reporting may have different levels for the same council.

## Current verified reference

Knowsley is the reference integration:

- exact address discovery;
- live dated collections with council bin names and colours;
- council-specific recycling guidance;
- official missed-bin eligibility and submission handoff;
- resident-confirmed report reference, status and expected recollection tracking.

The app does not claim direct missed-report submission because the current council journey is an official handoff. Nationwide directory adapters remain `experimental-adapter` unless promoted through a documented verification review.

## Promotion gate

A council is promoted only after:

1. service ownership and source terms are confirmed;
2. property selection and normal/bank-holiday dates pass controlled-address checks;
3. no-result, timeout and maintenance states fail safely;
4. bin labels, colours and local guidance are council-approved;
5. disruption and missed-bin routes are tested;
6. monitoring and a named operational contact exist.

The runtime source of truth is `COUNCIL_PROFILE_REGISTRY_JSON`, with built-in reference profiles kept under automated test.
