# Council gateway

This worker is the server-side boundary between What Bin Is It Tonight? and individual council collection sources.

## Why this exists

UK councils publish collection calendars and household-waste services in incompatible ways. A mobile app should not carry hundreds of brittle browser scrapers, expose provider keys, or silently guess dates. Instead, the gateway chooses an approved adapter from a server-side registry, normalises the result, and caches it.

## Run locally

```bash
cd services/council-gateway
npm install
npm run dev
```

Set the app’s `EXPO_PUBLIC_COUNCIL_API_BASE` to the tunnel/deployment URL. The adapter registry contains live-source integrations only; generated or demonstration collection dates are prohibited.

## Add a council

1. Confirm the council’s authorised collection-calendar source and terms of use.
2. Add an adapter in the shared `api/_gateway/adapter-registry.ts`; `src/adapter-registry.ts` re-exports that registry for the Worker. Adapters receive a postcode and address ID, then return dates in `YYYY-MM-DD` plus one of `general`, `recycling`, `garden`, or `food`. Add its optional `getServices` method for household waste sites, recycling points, reuse and collection services.
3. Test exceptions such as bank holidays, multi-stream dates, and address selection.
4. Configure caching and source monitoring before marking the provider live.
5. Keep the adapter ID server-side. Do not accept a client-provided source URL.

The route returns `404` for an unregistered provider instead of serving a guessed schedule.

The mobile client calls `GET /v1/services?postcode=…&providerId=…` for provider-owned local services. Until an adapter exposes that route, the client can show nearby OpenStreetMap recycling places, clearly labelled as map data rather than council-verified opening information.
