export type PwaInstallStatus = {
  supported: boolean;
  installed: boolean;
  canInstall: boolean;
  isIos: boolean;
};

export function registerPwa() {
  return () => undefined;
}

export function getPwaInstallStatus(): PwaInstallStatus {
  return { supported: false, installed: true, canInstall: false, isIos: false };
}

export function subscribePwaInstallStatus(_listener: () => void) {
  return () => undefined;
}

export async function installPwa() {
  return { installed: true, reason: undefined as string | undefined };
}
