# Council pilot measurement plan

## Purpose

Demonstrate that residents receive clearer, more reliable waste-service information while collecting only the minimum evidence needed for an authority decision.

## Definitions

- **Resident installation:** a random app-installation identifier linked only to the public council provider identifiers represented by its saved places. It is counted independently from optional app-improvement analytics and does not contain an address, postcode, property reference, account or email.
- **Active resident installation:** a resident installation whose current saved-place state includes the council and which has synced during the reporting period.
- **Currently linked installation:** a resident installation whose latest saved-place state includes the council. Uninstall cannot be detected.
- **All-time resident installation:** a resident installation that has ever linked to the council. Removing or changing a saved place does not reduce this measure; an explicit Clear all app data deletion does.
- **Consenting installation:** a random installation identifier that explicitly opted into pilot analytics and produced an event during the reporting period.
- **Reminder adoption:** consenting installations that enabled verified collection reminders divided by consenting installations.
- **Guide search:** a structured matched/no-match event. Raw resident search text is not uploaded.
- **Confirmed official submission:** a resident action confirming that they completed the council’s official reporting process. It is not a claim that What Bin submitted the report.
- **Gateway availability:** successful verified council-source checks divided by all recorded checks.

## Suggested pilot measures

- active, currently linked and all-time resident installations;
- verified collection lookup success;
- reminder adoption;
- guide matched/no-match rate by approved item key;
- official missed-report route opened;
- resident-confirmed council submission;
- live-message reach after consented broadcast channels are connected;
- gateway availability and response time.

Collection volumes, missed-bin totals and saved-cost claims must not be estimated from app events. Use an approved council round, CRM or service-management feed for those measures.

## Privacy controls

- the core council-reach installation ID is random, contains no household data and is erasable through Clear all app data;
- optional app-improvement analytics consent is opt-in and separate from council reach;
- analytics participant IDs are random and revocable;
- event context uses allowlisted codes;
- raw addresses, postcodes, search text and report narratives are excluded;
- low-volume export groups are suppressed;
- resident analytics can be deleted from the device;
- the console export is council-scoped and aggregate only.

## Pilot exit evidence

Agree the baseline, reporting period, minimum volume and decision threshold before launch. Every dashboard screenshot supplied as evidence should state its period, whether a measure covers resident installations or the smaller consenting analytics population, and any data gaps.
