# Council gateway

This worker is the server-side boundary between BinDay UK and individual council collection sources.

## Why this exists

UK councils publish collection calendars in incompatible ways. A mobile app should not carry hundreds of brittle browser scrapers, expose provider keys, or silently guess dates. Instead, the gateway chooses an approved adapter from a server-side registry, normalises the collection result, and caches it.

## Run locally

```bash
cd services/council-gateway
npm install
npm run dev
```

Set the app’s `EXPO_PUBLIC_COUNCIL_API_BASE` to the tunnel/deployment URL. The supplied `demo` adapter is only for contract testing; it cannot serve real households.

## Add a council

1. Confirm the council’s authorised collection-calendar source and terms of use.
2. Add an adapter in `src/adapter-registry.ts`; adapters receive a postcode and address ID, then return dates in `YYYY-MM-DD` plus one of `general`, `recycling`, `garden`, or `food`.
3. Test exceptions such as bank holidays, multi-stream dates, and address selection.
4. Configure caching and source monitoring before marking the provider live.
5. Keep the adapter ID server-side. Do not accept a client-provided source URL.

The route returns `404` for an unregistered provider instead of serving a guessed schedule.
