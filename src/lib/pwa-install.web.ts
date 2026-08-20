import type {
  PwaCacheDiagnostics,
  PwaCacheState,
  PwaInstallStatus,
} from '@/lib/pwa-install';

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

type PwaCacheStatusReply = {
  type: 'PWA_CACHE_STATUS';
  version: string;
  caches: { name: string; entries: number }[];
};

type PwaCacheClearedReply = {
  type: 'PWA_CACHE_CLEARED';
  deletedCaches: number;
};

const SERVICE_WORKER_MESSAGE_TIMEOUT_MS = 3_000;
const CACHE_VERSION_PATTERN = /^what-bin-[a-f0-9]{12}$/;

let installPrompt: InstallPromptEvent | undefined;
let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
let registrationCleanup: (() => void) | undefined;
let registered = false;
let updateAvailable = false;
let applyingUpdate = false;
let reloadedForUpdate = false;
let cacheState: PwaCacheState = 'unavailable';
let cacheEntries = 0;
let cacheVersion: string | undefined;
const listeners = new Set<() => void>();
const serverInstallStatus: PwaInstallStatus = {
  supported: false,
  installed: false,
  canInstall: false,
  isIos: false,
  updateAvailable: false,
  cacheState: 'unavailable',
  cacheEntries: 0,
};

function browserAvailable() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function serviceWorkersAvailable() {
  return browserAvailable() && 'serviceWorker' in navigator;
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
  const supported = serviceWorkersAvailable();
  return {
    supported,
    installed: isInstalled(),
    canInstall: Boolean(installPrompt),
    isIos: isIosDevice(),
    updateAvailable: supported && updateAvailable,
    cacheState: supported ? cacheState : 'unavailable',
    cacheEntries: supported ? cacheEntries : 0,
    cacheVersion: supported ? cacheVersion : undefined,
  };
}

let currentInstallStatus = readInstallStatus();

function emitStatus() {
  currentInstallStatus = readInstallStatus();
  listeners.forEach((listener) => listener());
}

function cacheDiagnostics(): PwaCacheDiagnostics {
  const status = readInstallStatus();
  return {
    cacheState: status.cacheState,
    cacheEntries: status.cacheEntries,
    cacheVersion: status.cacheVersion,
  };
}

function isCacheStatusReply(value: unknown): value is PwaCacheStatusReply {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Partial<PwaCacheStatusReply>;
  return input.type === 'PWA_CACHE_STATUS'
    && typeof input.version === 'string'
    && CACHE_VERSION_PATTERN.test(input.version)
    && Array.isArray(input.caches)
    && input.caches.length <= 16
    && input.caches.every((entry) => (
      entry
      && typeof entry === 'object'
      && typeof entry.name === 'string'
      && entry.name.startsWith('what-bin-')
      && Number.isSafeInteger(entry.entries)
      && entry.entries >= 0
      && entry.entries <= 10_000
    ));
}

function isCacheClearedReply(value: unknown): value is PwaCacheClearedReply {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Partial<PwaCacheClearedReply>;
  return input.type === 'PWA_CACHE_CLEARED'
    && Number.isSafeInteger(input.deletedCaches)
    && (input.deletedCaches ?? -1) >= 0
    && (input.deletedCaches ?? 129) <= 128;
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), SERVICE_WORKER_MESSAGE_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      () => {
        window.clearTimeout(timeout);
        reject(new Error(message));
      },
    );
  });
}

async function activeServiceWorker() {
  if (!serviceWorkersAvailable()) {
    throw new Error('Offline storage is not supported by this browser.');
  }
  if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
  const ready = await withTimeout(
    navigator.serviceWorker.ready,
    'The offline service is not ready. Please try again.',
  );
  const worker = ready.active;
  if (!worker) throw new Error('The offline service is not ready. Please try again.');
  return worker;
}

async function requestServiceWorkerMessage(type: 'PWA_CACHE_STATUS' | 'PWA_CLEAR_CACHES') {
  const worker = await activeServiceWorker();
  return new Promise<unknown>((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (callback: () => void) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      callback();
    };
    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error('The offline service did not respond. Please try again.')));
    }, SERVICE_WORKER_MESSAGE_TIMEOUT_MS);
    channel.port1.onmessage = (event) => finish(() => resolve(event.data));
    channel.port1.onmessageerror = () => finish(() => {
      reject(new Error('The offline service returned an invalid response.'));
    });
    try {
      worker.postMessage({ type }, [channel.port2]);
    } catch {
      finish(() => reject(new Error('The offline service could not receive the request.')));
    }
  });
}

function watchRegistration(registration: ServiceWorkerRegistration) {
  const workerCleanups = new Set<() => void>();
  const watchWorker = (worker: ServiceWorker | null) => {
    if (!worker) return;
    const onStateChange = () => {
      if (worker.state === 'installed') {
        updateAvailable = Boolean(navigator.serviceWorker.controller);
        emitStatus();
      } else if (worker.state === 'redundant') {
        updateAvailable = Boolean(registration.waiting);
        emitStatus();
      }
    };
    worker.addEventListener('statechange', onStateChange);
    workerCleanups.add(() => worker.removeEventListener('statechange', onStateChange));
    onStateChange();
  };
  const onUpdateFound = () => watchWorker(registration.installing);
  registration.addEventListener('updatefound', onUpdateFound);
  watchWorker(registration.installing);
  updateAvailable = Boolean(registration.waiting && navigator.serviceWorker.controller);
  emitStatus();
  return () => {
    registration.removeEventListener('updatefound', onUpdateFound);
    workerCleanups.forEach((cleanup) => cleanup());
  };
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
  if (process.env.NODE_ENV !== 'production' || !browserAvailable() || registered) {
    return () => undefined;
  }
  registered = true;
  let cancelled = false;
  if (serviceWorkersAvailable() && cacheState === 'unavailable') cacheState = 'unknown';

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
  const onControllerChange = () => {
    updateAvailable = false;
    cacheState = 'unknown';
    emitStatus();
    if (applyingUpdate && !reloadedForUpdate) {
      applyingUpdate = false;
      reloadedForUpdate = true;
      window.location.reload();
    }
  };
  const onServiceWorkerMessage = (event: MessageEvent<unknown>) => {
    if (!event.data || typeof event.data !== 'object' || Array.isArray(event.data)) return;
    const message = event.data as { type?: unknown; version?: unknown };
    if (message.type !== 'PWA_ACTIVATED') return;
    updateAvailable = false;
    if (typeof message.version === 'string' && CACHE_VERSION_PATTERN.test(message.version)) {
      cacheVersion = message.version;
    }
    cacheState = 'unknown';
    emitStatus();
    void refreshPwaCacheStatus();
  };

  window.addEventListener('beforeinstallprompt', onInstallPrompt);
  window.addEventListener('appinstalled', onInstalled);
  displayMode.addEventListener?.('change', onDisplayMode);
  if (serviceWorkersAvailable()) {
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (cancelled) return;
        serviceWorkerRegistration = registration;
        registrationCleanup?.();
        registrationCleanup = watchRegistration(registration);
        emitStatus();
        void refreshPwaCacheStatus();
        void registration.update().catch(() => undefined);
      })
      .catch(() => {
        if (cancelled) return;
        cacheState = 'error';
        emitStatus();
      });
  }
  emitStatus();

  return () => {
    cancelled = true;
    window.removeEventListener('beforeinstallprompt', onInstallPrompt);
    window.removeEventListener('appinstalled', onInstalled);
    displayMode.removeEventListener?.('change', onDisplayMode);
    if (serviceWorkersAvailable()) {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
    }
    registrationCleanup?.();
    registrationCleanup = undefined;
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

export async function applyPwaUpdate() {
  if (!serviceWorkersAvailable()) {
    return { applied: false, reason: 'App updates are not supported by this browser.' };
  }
  try {
    const registration = serviceWorkerRegistration
      ?? await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      return { applied: false, reason: 'The offline app is not registered yet.' };
    }
    serviceWorkerRegistration = registration;
    const waiting = registration.waiting;
    if (!waiting) {
      void registration.update().catch(() => undefined);
      updateAvailable = false;
      emitStatus();
      return { applied: false, reason: 'No app update is ready yet.' };
    }
    applyingUpdate = true;
    reloadedForUpdate = false;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    return { applied: true, reason: undefined };
  } catch {
    applyingUpdate = false;
    return { applied: false, reason: 'The app update could not be applied. Please try again.' };
  }
}

export async function refreshPwaCacheStatus(): Promise<PwaCacheDiagnostics> {
  if (!serviceWorkersAvailable()) {
    cacheState = 'unavailable';
    cacheEntries = 0;
    cacheVersion = undefined;
    emitStatus();
    return cacheDiagnostics();
  }
  cacheState = 'checking';
  emitStatus();
  try {
    const reply = await requestServiceWorkerMessage('PWA_CACHE_STATUS');
    if (!isCacheStatusReply(reply)) throw new Error('Invalid offline cache status.');
    cacheState = 'ready';
    cacheEntries = reply.caches.reduce((total, cache) => total + cache.entries, 0);
    cacheVersion = reply.version;
  } catch {
    cacheState = 'error';
  }
  emitStatus();
  return cacheDiagnostics();
}

export async function resetPwaCaches() {
  if (!serviceWorkersAvailable()) {
    return {
      cleared: false,
      deletedCaches: 0,
      reason: 'Offline storage is not supported by this browser.',
    };
  }
  try {
    const reply = await requestServiceWorkerMessage('PWA_CLEAR_CACHES');
    if (!isCacheClearedReply(reply)) throw new Error('Invalid offline cache reset response.');
    cacheState = 'cleared';
    cacheEntries = 0;
    emitStatus();
    return { cleared: true, deletedCaches: reply.deletedCaches, reason: undefined };
  } catch {
    cacheState = 'error';
    emitStatus();
    return {
      cleared: false,
      deletedCaches: 0,
      reason: 'Offline storage could not be cleared. Please try again.',
    };
  }
}
