import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { CouncilProfile, fetchCouncilProfile } from '@/lib/council-provider';

export function useCouncilProfile(providerId?: string) {
  const [profile, setProfile] = useState<CouncilProfile>();
  useEffect(() => {
    let active = true;
    let refreshing = false;
    if (!providerId) {
      return () => { active = false; };
    }
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const nextProfile = await fetchCouncilProfile(providerId);
        if (active && nextProfile.providerId === providerId) setProfile(nextProfile);
      } catch {
        if (active) setProfile(undefined);
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 60_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      active = false;
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [providerId]);
  return profile?.providerId === providerId ? profile : undefined;
}
