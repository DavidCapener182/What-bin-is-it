import type { PwaInstallStatus } from '@/lib/pwa-install';

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

let installPrompt: InstallPromptEvent | undefined;
let registered = false;
const listeners = new Set<() => void>();
const serverInstallStatus: PwaInstallStatus = {
  supported: false,
  installed: false,
  canInstall: false,
  isIos: false,
};

function browserAvailable() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function isIosDevice() {
  if (!browserAvailable()) return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  if (!browserAvailable()) return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as NavigatorWithStandalone).standalone);
}

function readInstallStatus(): PwaInstallStatus {
  return {
    supported: browserAvailable() && 'serviceWorker' in navigator,
    installed: isInstalled(),
    canInstall: Boolean(installPrompt),
    isIos: isIosDevice(),
  };
}

let currentInstallStatus = readInstallStatus();

function emitStatus() {
  currentInstallStatus = readInstallStatus();
  listeners.forEach((listener) => listener());
}

export function getPwaInstallStatus(): PwaInstallStatus {
  return currentInstallStatus;
}

export function getPwaServerInstallStatus(): PwaInstallStatus {
  return serverInstallStatus;
}

export function subscribePwaInstallStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerPwa() {
  if (!browserAvailable() || registered) return () => undefined;
  registered = true;

  const onInstallPrompt = (event: Event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    emitStatus();
  };
  const onInstalled = () => {
    installPrompt = undefined;
    emitStatus();
  };
  const displayMode = window.matchMedia('(display-mode: standalone)');
  const onDisplayMode = () => emitStatus();

  window.addEventListener('beforeinstallprompt', onInstallPrompt);
  window.addEventListener('appinstalled', onInstalled);
  displayMode.addEventListener?.('change', onDisplayMode);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        emitStatus();
        return registration.update();
      })
      .catch(() => undefined);
  }

  return () => {
    window.removeEventListener('beforeinstallprompt', onInstallPrompt);
    window.removeEventListener('appinstalled', onInstalled);
    displayMode.removeEventListener?.('change', onDisplayMode);
    registered = false;
  };
}

export async function installPwa() {
  if (isInstalled()) return { installed: true, reason: undefined };
  if (installPrompt) {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = undefined;
    emitStatus();
    return {
      installed: choice.outcome === 'accepted',
      reason: choice.outcome === 'accepted' ? undefined : 'Installation was dismissed.',
    };
  }
  if (isIosDevice()) {
    return {
      installed: false,
      reason: 'In Safari, tap Share, then “Add to Home Screen”. Open the new app icon to turn on reminders.',
    };
  }
  return {
    installed: false,
    reason: 'Open your browser menu and choose “Install app” or “Add to Home Screen”.',
  };
}
