import { useNetworkState } from 'expo-network';

import { networkStateIsOnline } from '@/lib/network-state';

export function useOnlineStatus() {
  return networkStateIsOnline(useNetworkState());
}
