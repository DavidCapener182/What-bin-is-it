# Council outreach playbook

## Who to target

Start with councils or housing providers where at least one of these is visible:

- residents are sent through several steps to find a collection;
- the council already publishes a structured address or collection feed;
- collection changes generate avoidable contact;
- missed-bin eligibility is hard to understand;
- contamination or recycling education is a stated priority;
- the council is replacing a resident app or waste CRM;
- a digital, waste, customer-service or transformation lead can sponsor a contained pilot.

Likely roles:

- Head of Waste or Waste Services Manager
- Digital Services or Product Manager
- Customer Experience / Contact Centre Lead
- Transformation or Innovation Lead
- Recycling and Behaviour Change Lead
- Housing Operations Lead
- Information Governance and Integration leads after initial interest

Use [operations/councils/pipeline.csv](../../operations/councils/pipeline.csv) as the source of truth. `nationwide-routing-unverified` means the app can identify the authority and attempt an approved nationwide lookup; it is not a claim that live dates work.

## First email

**Subject:** A smaller pilot to make bin-day information easier for residents

Hello [name],

I am building What Bin Is It Tonight?, a resident-first iPhone, Android and web app that gives one clear answer for the next collection, then connects reminders, recycling guidance, disruptions and the council’s missed-bin route.

The aim is not another generic council app. It is to reduce avoidable contact, improve recycling accuracy and make resident reporting easier, while keeping essential collection information free and never selling address data.

I would like to explore a contained 12-week pilot for [council]. We would use an approved collection source, select exact properties, agree accuracy and service measures before launch, and never display estimated dates as fact.

Would a 25-minute discovery call with the waste and digital service owners be useful? I can share the working app, integration contract and pilot assurance pack in advance.

Regards,

[name]
[role / company]
[email]
[phone]

## Follow-up after five working days

Hello [name],

I wanted to bring this back to the top of your inbox. The pilot is deliberately narrow: one council area, an approved live collection source, a controlled release and agreed evidence before any wider commitment.

If another person owns resident waste information or digital customer contact, would you point me to them?

Regards,
[name]

## Discovery call

Ask:

1. What do residents contact you about most often around collections?
2. How are collection dates currently exposed and what exact property key is used?
3. Who owns bank-holiday and disruption changes?
4. What makes a missed collection eligible, and when can it be submitted?
5. Can a resident receive status updates after a report?
6. Which recycling questions create the most contamination or repeat contact?
7. What accessibility, Welsh-language or other localization obligations apply?
8. What baseline contact or web-completion measures already exist?
9. Which CRM, waste system and authentication boundaries apply?
10. Who signs off data protection, security, content and go-live?

Do not promise:

- that every address is already live;
- direct CRM submission without an agreed API;
- a contact reduction percentage before a baseline exists;
- formal security certification that has not been obtained;
- council-owned branding or data rights without written approval.

## Qualification

Move a prospect to `discovery` only when there is a named service owner and a plausible approved data route. Move to `technical-discovery` only when a council data or integration owner is involved. Move to `proposal` only after the pilot boundary, success measures and dependencies are written down.

Suggested `commercial_stage` values:

- `not-contacted`
- `researching`
- `contacted`
- `follow-up`
- `discovery`
- `technical-discovery`
- `proposal`
- `procurement`
- `pilot-agreed`
- `pilot-live`
- `won`
- `paused`
- `closed`

## Demo sequence

1. Enter a real pilot postcode.
2. Choose the exact property.
3. Show the named source and last verification time.
4. Show what goes out tonight and the schedule.
5. Enable reminders.
6. Search a difficult item and show local caveats.
7. Show a recycling site with declared materials.
8. Walk through missed-bin eligibility without claiming submission.
9. Show cached, unavailable and wrong-data states.
10. Finish with the partner feed contract and pilot measures.
