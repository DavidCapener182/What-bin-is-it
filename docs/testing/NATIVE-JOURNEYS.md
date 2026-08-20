# Native proof journeys

The committed Maestro suite is a deterministic, non-production release gate. Six common flows run on both platforms, two Android-only flows exercise offline and back behavior, and one iOS-only flow reaches the Live Activity setting boundary.

| Coverage | Scripted proof boundary | Deliberately not claimed |
| --- | --- | --- |
| Onboarding and manual postcode | Opens onboarding and rejects a synthetic invalid postcode locally | Live council/address lookup |
| Primary navigation | Opens Today, Schedule, Guide and Activity and checks back history | Physical accessibility and rotation acceptance |
| Push/deep link | Opens the approved Activity destination through the app scheme | Receipt or tap of a remote notification |
| Magic-link return | Opens a synthetic cancelled `/account` return with no credentials | Email delivery or Supabase session exchange |
| Notification permission and reminders | Proves denied handling, grants notification permission through Maestro, enables reminders, sees the future fixture schedule, relaunches, then disables reminders for cleanup | A real OS prompt or a reminder firing on hardware |
| Widget refresh boundary | Loads the selected synthetic address and verified schedule through the state-to-widget sync path and checks the in-app native widget snapshot | Adding a widget or observing extension/background refresh in the OS gallery |
| Purchase and restore gates | Confirms proof mode shows `Free proof release` and exposes no purchase, restore or payment action | App Store or Play sandbox transactions |
| Bulky checkout return | Opens the exact synthetic cancellation-return shape and confirms no status lookup or payment action appears | Hosted checkout, universal-link association or provider reconciliation |
| Android offline cold start | Enables airplane mode, kills the app, relaunches saved fixture dates and waits for the offline label, then restores connectivity | iOS airplane mode, which Maestro cannot control, or physical radio behavior |
| Android Predictive Back | Uses system back through address, reminder and Settings routes while Predictive Back remains enabled | The predictive gesture animation across OEM/API combinations |
| iOS Live Activity boundary | Enables the bin-night surface with a tomorrow fixture, relaunches, then disables it for cleanup | Lock Screen or Dynamic Island rendering and lifecycle on a physical iPhone |

## Fail-closed profile

The `e2e-test` EAS profile is internal-only and must satisfy every guard below before synthetic data can load:

- `EXPO_PUBLIC_NATIVE_E2E_FIXTURES=maestro-proof-v1`;
- launch phase `proof` and native purchases explicitly `false`;
- council API fixed to the non-listening loopback endpoint `https://127.0.0.1:1/api`;
- Supabase and RevenueCat public configuration explicitly blank.

If any guard differs or any remote account/store credential is present, fixture loading is disabled. The flows contain no email address, authentication material, real property, provider action or production URL. Initial app state and keychain are cleared, all permissions start denied, airplane mode is restored, reminder/Live Activity settings are turned back off, and the bulky route uses only a cancelled synthetic reference.

## Static and EAS gates

`npm run test:native:static` recursively parses every flow, enforces the exact inventory and coverage tags, allowlists Maestro commands and app-only deep links, rejects credential-bearing URL shapes, verifies platform separation, checks the guarded fixture/network/widget/notification/Live Activity boundaries, and validates the EAS profile and workflow. GitHub runs this no-secret static gate for every pull request.

The manually dispatched `.eas/workflows/native-proof-journeys.yml` builds an internal Android APK and iOS simulator app, then runs pinned Maestro 2.7.0 with screen recordings:

```sh
eas workflow:run .eas/workflows/native-proof-journeys.yml
```

The workflow is intentionally not attached to push, pull-request or production-deployment triggers. A reviewer must retain successful EAS build, JUnit and recording artifacts. Committed manifests and static validation are not evidence that this workflow or a physical-device pass ran.

## Residual physical and sandbox release gates

Before native release, record separate evidence for:

- the real iOS/Android notification permission prompt, scheduled reminder delivery under normal and background-restricted conditions, and remote push receipt/action from foreground, background and terminated states;
- iOS hardware offline cold start and reconnection, plus supported-device network transitions;
- installed Home Screen widget placement, timeline/background refresh and tap routing on iOS and Android;
- a delivered password-free email link, valid/expired return handling and authenticated session exchange on both platforms;
- signed App Store and Google Play sandbox purchase, restore, transfer, refund/reversal and entitlement expiry while release payment flags remain false until approval;
- the hosted bulky-checkout browser handoff, cancellation/success return association and provider/status reconciliation;
- Android Predictive Back gesture animation across supported API/OEM targets;
- iOS Live Activity start, update and end rendering on the Lock Screen and Dynamic Island.

The remaining wider physical-device checklist, including location, accessibility, tablet and rotation acceptance, stays in `docs/store/LAUNCH-CHECKLIST.md`.
