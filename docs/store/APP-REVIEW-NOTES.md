# App Review notes — version 1.1.0

What Bin Is It Tonight? is an independent UK household utility. It is not a council service and does not generate collection schedules.

No account or payment is required in this release.

## Review path

1. Open **Places** from onboarding or Settings.
2. Enter the supplied review postcode.
3. Choose the exact property from the returned council address list.
4. Refresh collection dates.
5. Open **Today** and **Schedule** to see the source name and last verification time.
6. Open **Settings** and enable reminders.
7. Open **Guide** to search household items and nearby services.

Before submission, replace this section with a verified, publication-safe review address:

- Postcode: `[ADD REVIEW POSTCODE]`
- Property: `[ADD EXACT PROPERTY]`
- Expected next collections: `[CHECK ON SUBMISSION DAY]`
- Source: `[ADD NAMED SOURCE]`

Do not submit until those values have been checked on the same production build. Collection dates change and must not be copied from an old review note.

## Permissions

- **Location:** requested only when the reviewer taps “Use my current location”; it finds a postcode and council. Manual entry is always available. There is no background location.
- **Notifications:** requested only after the reviewer enables a reminder. Native reminders are scheduled from verified collection dates.
- **Android exact alarm:** supports the core scheduled reminder at the selected time. The app uses `SCHEDULE_EXACT_ALARM` and remains usable if access is not granted.

## Data

Saved addresses, schedules, preferences, local report history and collection outcomes are stored on the device. Postcode, council provider ID and selected opaque property reference are sent only for a requested live lookup. There is no advertising or tracking SDK.

## Missed collections

The app guides eligibility and opens the official council route. It does not tell the user that a council report was submitted until the council confirms it. A local tracking ID is not shown as a council reference.

## Support

- Support: `https://what-bin-is-it-tonight.vercel.app/support`
- Privacy: `https://what-bin-is-it-tonight.vercel.app/privacy`
- Terms: `https://what-bin-is-it-tonight.vercel.app/terms`
- Data sources: `https://what-bin-is-it-tonight.vercel.app/data-sources`
