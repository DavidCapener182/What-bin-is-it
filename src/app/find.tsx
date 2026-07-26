import { Redirect } from 'expo-router';

import { RouteHead } from '@/components/route-head';

export default function FindRedirect() {
  return (
    <>
      <RouteHead
        title="Recycling Guide"
        description="Search household items to see whether they belong in a bin or need a local recycling service."
        path="/guide"
      />
      <Redirect href="/guide" />
    </>
  );
}
