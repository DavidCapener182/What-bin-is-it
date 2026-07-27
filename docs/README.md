# Launch and partnership pack

This folder contains the material needed to move **What Bin Is It Tonight?** from a working resident app into council pilots and the first iOS and Android releases.

## Start here

- [Council pilot one-page offer](councils/PILOT-OFFER.md)
- [Council outreach playbook](councils/OUTREACH.md)
- [Pilot success measures](councils/SUCCESS-MEASURES.md)
- [Council data integration guide](councils/INTEGRATION.md)
- [Published council coverage model](councils/COVERAGE.md)
- [Data protection, security and procurement answers](councils/ASSURANCE.md)
- [Commercial product model](commercial/PRODUCT-MODEL.md)
- [Technical architecture](architecture/OVERVIEW.md)
- [Authentication and billing controls](security/AUTH-BILLING.md)
- [Known limitations](KNOWN-LIMITATIONS.md)
- [Property and housing pilot](property/PROPERTY-PILOT.md)
- [App Store and Google Play launch checklist](store/LAUNCH-CHECKLIST.md)
- [Store privacy declarations](store/PRIVACY-DECLARATIONS.md)

The live targeting sheet is [operations/councils/pipeline.csv](../operations/councils/pipeline.csv). Run `npm run councils:sync` after the council directory changes; existing contact and pipeline notes are preserved.

## Truth standard

The 361-council directory proves postcode-to-authority routing coverage, not live collection-date coverage. A council is described as connected only after an exact property lookup returns non-estimated dates from a verified source.

The first store release remains free while collection accuracy is proven. Plus product identifiers, Stripe/RevenueCat adapters and server-side entitlement reconciliation are present, but resident payment prompts stay off during the `proof` launch phase.
