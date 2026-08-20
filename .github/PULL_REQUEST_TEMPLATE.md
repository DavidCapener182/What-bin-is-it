## What changed

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:native:static`
- [ ] `npm run test:browser:resident` after `npm run build:web` when resident/PWA behavior changed
- [ ] `cd council-backoffice && npm run test:e2e` when console behavior changed
- [ ] `npm run store:check` when store-facing configuration or copy changed
- [ ] EAS Maestro run or documented physical-device check when native behavior changed

## Council-data truth check

- [ ] No runtime collection date is generated, estimated or hard-coded.
- [ ] Exact-property selection is preserved where the source requires it.
- [ ] Provider identity, source and verification time remain visible.
- [ ] Unsupported and failed sources produce an honest state.
- [ ] No council credential or resident address was committed.
- [ ] Payment and nationwide fallback flags remain false unless their separate live release gates are evidenced.
