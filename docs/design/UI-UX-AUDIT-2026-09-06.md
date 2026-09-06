# Web UI and UX audit • 6 September 2026

The user chose to refine the existing blue identity. This pass covers the resident web app and council console, with shared styles applied across the route inventory. Residents need to check bin night quickly at home or on a phone outdoors; staff need to scan queues and complete forms during their working day. The design keeps bright, readable light surfaces and a blue-slate resident dark theme, familiar system typography, and restrained blue actions.

## Findings and implemented changes

| Priority | Finding | Update |
| --- | --- | --- |
| P1 | Console page-header actions disappeared below 780px. | Keep actions visible and stack them beneath the heading. |
| P1 | Several close, segmented and small console controls were 34–42px. | Increase the affected controls to at least 44px. |
| P1 | Dark report cancellation text fell below AA contrast against the revised surface (4.46:1). | Lighten the danger colour; automated dark-mode checks now pass. |
| P1 | Enlarged Today action headings could overflow their row. | Give the heading a bounded flexible column so it wraps. |
| P2 | Desktop first-run, settings, places, household, Plus and legal content stretched excessively. | Centre those forms and reading surfaces at readable widths. |
| P2 | Desktop utility navigation required returning through Today. | Add persistent Saved places and Settings actions to the branded rail. |
| P2 | Onboarding action sat far from its postcode field and the step did not scroll. | Group input and action, move benefits after the action, and allow scrolling on short screens. Keep property selection in its own virtualised list. |
| P2 | Console hover and secondary UI references used undefined colour tokens. | Define surface, grouped, text, muted and separator aliases. |
| P2 | Incorrect-information form began with implementation terminology. | Replace it with plain-language recipient and privacy guidance; retain exact payload review. |
| P3 | Heavy shadows, accent stripes and inconsistent spacing competed with content. | Refine shared surfaces, borders, heading rhythm, guide rows, calendar cards and settings groups; remove decorative stripes and console blur. |

The existing tab keyboard navigation, explicit council confirmations, safe-area work, council bin colours, verified-date rules, reduced-motion handling, and account boundaries are retained.

## Coverage

- Resident core: Today, Schedule, Guide and item detail, Activity, Settings, Places, Reports, Support and Account were exercised through the existing browser suite, including search, account boundaries, calendar export, official report handoff, and fixture-only support actions.
- Responsive suite: 320, 375, 430, 768, 1024 and 1440px; light/dark appearance; standard/130% text. Automated AA checks cover nine representative surfaces in both appearances.
- Additional live mobile checks at 375px: Household, Plus, Privacy, Terms, Data sources, Status, Offline, Incorrect information, Bulky booking, Partnerships, Calendar and Reminder settings. Each rendered without document-level horizontal overflow. Status showed an explicit fetch error because the local static server has no live status API.
- Council: shared CSS covers all council and platform routes, login, forms, queues, previews and drawers. Existing generated-workspace tests exercised authentication boundaries, announcements, disruptions, support, partner approval, booking confirmation, queue filters and saved views, keyboard focus, and responsive tables. Desktop/mobile announcement and support screenshots were reviewed.
- Visual inspection: resident desktop first run, guide and settings; short-phone onboarding; enlarged dark Today; console desktop/mobile announcement queues. Updated the existing visual baselines, including unchanged screenshots, to record the actual new build.

## Validation and limits

- Resident browser suite: 40 passed. Final onboarding adjustment: 1 focused journey passed.
- Console browser suite: 14 passed; 6 intentional duplicate mobile functional cases skipped by the existing suite.
- Resident unit suite: 266 passed on the final run, including concurrent collection work.
- Council unit suite: 45 passed.
- Resident and console lint passed. Resident web export and council production build passed.
- Resident typecheck passes with the pre-existing untracked `src/app/reports 2.tsx` excluded in a temporary validation config. The unmodified standard command still reports that duplicate file’s missing `styles.content` property. The temporary config does not change project configuration.
- Native devices, live council data and production deployment were not tested by this UI pass. Browser fixtures are test data, not evidence of live provider availability. The console remains explicitly light-themed.
- Concurrent safe-area and collection-provider changes were present during this work; they are retained and are not attributed to this design pass. These separate changes are excluded from the isolated UI release branch.

## Isolated release validation

The UI release is isolated on `codex/web-ui-ux-polish` from `4d1464f`, retaining the merged mobile safe-area fix and excluding concurrent provider work and untracked duplicate files. Standard resident TypeScript and lint pass in this checkout; 257 resident unit tests, five native fixture checks and all 40 browser journeys pass. The full resident web/server production build passes. The privacy-copy regression assertion now checks the revised warning and preview instruction. Store repository checks and the production dependency audit pass.

The council changes are identical to the audited checkout: 45 unit tests, lint, the production build and TypeScript pass. Its browser evidence remains the 14 passing cases recorded above.

The static preview now returns an explicit JSON 503 for unavailable local API routes. `npm run preview:web` rebuilds with a cleared Metro cache and connects the deployed gateway. Live postcode results and deployment are not claimed by this release.
