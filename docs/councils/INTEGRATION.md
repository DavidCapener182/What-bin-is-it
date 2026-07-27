# Approved council feed integration

## Objective

A council partner can replace the general nationwide lookup with an approved HTTPS feed without shipping a new mobile binary. Connector metadata is held in the server-only `COUNCIL_PARTNER_REGISTRY_JSON` environment variable; credentials stay in separately named server secrets.

The mobile app never receives a council credential.

Council content and coverage are configured separately through the server-only
`COUNCIL_PROFILE_REGISTRY_JSON`. A profile can publish:

- one of the six coverage states in [COVERAGE.md](COVERAGE.md);
- independent capability states for addresses, collections, guidance, services, alerts and missed reporting;
- council-owned help, service and missed-bin links;
- local bin names and colours;
- item-level accepted/rejected/preparation guidance.

The client obtains this from `GET /v1/profile?providerId=...`, so guidance can
change without an App Store or Play Store release.

## Identity

Each connector is keyed by the ONS local-authority district provider ID already used by the app:

```text
lad-e08000003
```

The connector registry entry contains:

- `providerId`: exact app provider ID;
- `councilName`: exact response name;
- `baseUrl`: council-controlled or approved HTTPS base URL;
- `capabilities`: `collections` plus optional `addresses` and `services`;
- `credentialEnv`: name of the separate server secret;
- optional `authHeader` and `authScheme`.

Illustrative connector definition:

```json
[
  {
    "providerId": "lad-e08000003",
    "councilName": "Manchester",
    "baseUrl": "https://waste.example.gov.uk/what-bin",
    "capabilities": ["addresses", "collections", "services"],
    "credentialEnv": "MANCHESTER_COUNCIL_API_KEY"
  }
]
```

This is a contract example, not a claim that the named council is connected.

## Required endpoint: collections

```http
POST /v1/collections
Authorization: Bearer <server credential>
Content-Type: application/json
```

Request:

```json
{
  "postcode": "M1 1AE",
  "propertyReference": "10000000001"
}
```

Response:

```json
{
  "councilName": "Manchester",
  "providerId": "lad-e08000003",
  "verifiedAt": "2026-07-26T12:00:00.000Z",
  "notice": "Live collection dates supplied by the council.",
  "collections": [
    {
      "date": "2026-07-31",
      "wasteType": "general",
      "label": "Grey bin",
      "colour": "#374151"
    }
  ],
  "alerts": []
}
```

Rules:

- `date` is a real `YYYY-MM-DD` collection date, never an estimate;
- `wasteType` is `general`, `recycling`, `garden`, `food` or `other`;
- a source-generated bin name can be supplied in `label`;
- `colour`, when supplied, is a six-digit hex colour;
- `providerId` and `councilName` must match the connector;
- `verifiedAt` records when the response was checked;
- no full address is required when the opaque property reference is sufficient.

If the council only has a repeating rota and cannot confirm dated collections, return an error rather than calculated dates.

## Optional endpoint: addresses

```http
GET /v1/addresses?postcode=M1%201AE
Authorization: Bearer <server credential>
```

Response:

```json
{
  "addresses": [
    {
      "id": "10000000001",
      "line1": "1 Test Street",
      "postcode": "M1 1AE"
    }
  ]
}
```

The `id` should be an opaque stable property reference such as a UPRN. Results must be limited to the requested postcode. The app requires an exact property before it requests dates where a source is property-specific.

## Optional endpoint: local services

```http
GET /v1/services?postcode=M1%201AE
Authorization: Bearer <server credential>
```

Response fields:

- `id`;
- `name`;
- `type`: `recycling-centre`, `recycling-point`, `reuse` or `collection`;
- `latitude` and `longitude`;
- optional address, website, declared materials, opening hours, operator, council-operated flag and wheelchair-accessible flag.

Only list accepted materials when the source declares them.

## Disruption alerts

Alerts can be included in a collection response:

- stable ID;
- title and plain-language detail;
- official HTTPS source;
- start and optional end time;
- optional expected recollection date;
- verification time.

The council remains the content owner. The app displays the source and will not generate an expected recollection date.

## Missed collection reporting

A connector may expose eligibility, known delays and report submission as
separate capabilities. Direct submission is permitted only where the response
can confirm acceptance and return a council reference or explicit council
status. Otherwise the app opens the official council form and asks the resident
to confirm the returned reference/status.

The app must never:

- describe a local tracking ID as a council reference;
- offer reporting before the council collection window has ended;
- submit during a known service delay when the council says to wait;
- invent an expected recollection date.

## Onboarding checklist

1. Confirm the ONS code and service owner.
2. Agree the approved feed and its terms of use.
3. Agree authentication, IP restrictions and credential rotation.
4. Map property references, bin names, types and colours.
5. Test valid, invalid, multi-property and unsupported postcodes.
6. Test normal dates, bank holidays, disruptions and no-result states.
7. Confirm timeout, rate limit and maintenance behavior.
8. Jointly audit a controlled set of real addresses.
9. Complete DPA/DPIA and retention decisions.
10. Add the registry entry and credential to preview.
11. Pass automated gateway tests and staff acceptance.
12. Promote the same connector metadata and secret to production.

## Operational behavior

- Partner requests time out after 15 seconds.
- Redirects are rejected.
- Connector base URLs must use HTTPS and cannot contain embedded credentials.
- Registry duplicates and invalid definitions make the health check fail.
- A missing server secret fails that connector visibly; it does not expose the secret or invent dates.
- Council responses pass the same gateway validation as all other sources.

## Other integration routes

If a council cannot expose this contract directly, the gateway can use:

1. an approved adapter for its existing JSON/XML API;
2. an agreed server-side transform from a secure data feed;
3. an approved extraction connector with explicit ownership and monitoring.

Do not embed council scraping or credentials in the iOS, Android or web client.
