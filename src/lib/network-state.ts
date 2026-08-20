export type ReachabilityState = {
  isConnected?: boolean;
  isInternetReachable?: boolean;
};

/**
 * Treat the short initial "unknown" state as usable, but immediately switch
 * offline when either the device connection or internet reachability is known
 * to be false.
 */
export function networkStateIsOnline(state: ReachabilityState) {
  return state.isConnected !== false && state.isInternetReachable !== false;
}
