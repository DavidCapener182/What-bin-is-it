export type PwaCacheState = 'unavailable' | 'unknown' | 'checking' | 'ready' | 'cleared' | 'error';

export type PwaInstallStatus = {
  supported: boolean;
  installed: boolean;
  canInstall: boolean;
  isIos: boolean;
  updateAvailable: boolean;
  cacheState: PwaCacheState;
  cacheEntries: number;
  cacheVersion?: string;
};

export type PwaCacheDiagnostics = Pick<
  PwaInstallStatus,
  'cacheState' | 'cacheEntries' | 'cacheVersion'
>;

export function registerPwa() {
  return () => undefined;
}

export function getPwaInstallStatus(): PwaInstallStatus {
  return {
    supported: false,
    installed: true,
    canInstall: false,
    isIos: false,
    updateAvailable: false,
    cacheState: 'unavailable',
    cacheEntries: 0,
  };
}

export function subscribePwaInstallStatus(_listener: () => void) {
  return () => undefined;
}

export async function installPwa() {
  return { installed: true, reason: undefined as string | undefined };
}

export async function applyPwaUpdate() {
  return { applied: false, reason: 'App updates are only available on the web.' };
}

export async function refreshPwaCacheStatus(): Promise<PwaCacheDiagnostics> {
  return { cacheState: 'unavailable', cacheEntries: 0 };
}

export async function resetPwaCaches() {
  return {
    cleared: false,
    deletedCaches: 0,
    reason: 'Offline storage controls are only available on the web.',
  };
}
