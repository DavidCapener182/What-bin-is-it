import { LegalScreen } from '@/components/legal-screen';

export default function DataSourcesScreen() {
  return (
    <LegalScreen
      description="The official and map data sources used by What Bin Is It Tonight?."
      path="/data-sources"
      sections={[
        {
          title: 'Postcodes and councils',
          body: 'Postcodes.io resolves a UK postcode or one-time device location to the relevant local-authority code. The app then requests the exact property where the connected collection source requires it.',
        },
        {
          title: 'Collection dates',
          body: 'Dates come from a direct council adapter, an approved partner feed or an explicitly experimental nationwide adapter. Only dated, non-estimated results are stored. The Schedule screen names the source and last successful check. Directory routing does not mean every council has a verified live schedule.',
        },
        {
          title: 'Missed and bulky collection routes',
          body: 'GOV.UK routes postcodes to official council missed-bin and bulky-waste services. Where a council policy has been verified, the app also shows its reporting window and links to the policy source.',
        },
        {
          title: 'Local recycling services',
          body: 'Council listings are preferred when available. Otherwise the app uses nearby OpenStreetMap recycling features. Map results are labelled and accepted materials are shown only when the source declares them.',
        },
        {
          title: 'Guide information',
          body: 'The household guide provides cautious UK-wide preparation advice. A connected council profile can supply local accepted items, rejected items, preparation rules, bin names and colours without an app release. “Check locally” remains visible when a council profile is not connected or rules genuinely differ.',
        },
      ]}
      title="Data sources"
      updated="27 July 2026"
    />
  );
}
