import { Redirect } from 'expo-router';

import { RouteHead } from '@/components/route-head';

export default function CalendarRedirect() {
  return (
    <>
      <RouteHead
        title="Collection Schedule"
        description="View upcoming verified bin collections for your saved UK address."
        path="/schedule"
      />
      <Redirect href="/schedule" />
    </>
  );
}
