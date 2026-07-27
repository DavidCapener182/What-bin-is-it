import { useEffect, useState } from 'react';

import { CouncilProfile, fetchCouncilProfile } from '@/lib/council-provider';

export function useCouncilProfile(providerId?: string) {
  const [profile, setProfile] = useState<CouncilProfile>();
  useEffect(() => {
    let active = true;
    if (!providerId) {
      return () => { active = false; };
    }
    void fetchCouncilProfile(providerId)
      .then((nextProfile) => {
        if (active && nextProfile.providerId === providerId) setProfile(nextProfile);
      })
      .catch(() => {
        if (active) setProfile(undefined);
      });
    return () => { active = false; };
  }, [providerId]);
  return profile?.providerId === providerId ? profile : undefined;
}
