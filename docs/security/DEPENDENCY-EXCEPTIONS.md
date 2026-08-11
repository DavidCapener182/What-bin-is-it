# Production dependency exceptions

## Metro `image-size` advisory

Reviewed: 11 August 2026

The Expo SDK 57 Metro toolchain currently installs this production dependency
path:

```text
expo 57.0.12
└─ @expo/metro 56.0.0
   └─ metro 0.84.4
      └─ image-size 1.2.1
```

Metro declares `image-size` as `^1.0.2`. At the review date, npm's latest
published `image-size` release is `2.0.2`, and both the installed version and
that latest release are covered by:

- `GHSA-w3rx-r6r6-pgpr` (`image-size`, `<=2.0.2`)
- `GHSA-5p2g-fcmc-qvqq` (`image-size`, `<=2.0.2`)

There is therefore no patched published version that can be selected without
inventing an unavailable release or replacing Expo's SDK 57 Metro stack.

`npm run audit:production` remains a blocking audit. Its implementation in
`scripts/audit-production.mjs` permits only those two exact advisory IDs for
`image-size` version `1.2.1` at `node_modules/image-size`, reached through
Metro's reviewed `^1.0.2` dependency. A changed version, path, advisory set, or
any other high or critical advisory fails the command.

Remove the exception as soon as Expo/Metro publishes a compatible dependency
on a non-vulnerable `image-size` release. Do not use `npm audit fix --force` or
downgrade Expo to make the advisory disappear.
