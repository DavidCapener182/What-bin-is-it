import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

export const pilotAnalyticsEventNames = [
  'analytics_consent_granted',
  'postcode_lookup_started',
  'postcode_lookup_succeeded',
  'postcode_lookup_failed',
  'address_options_loaded',
  'exact_address_selected',
  'collection_lookup_started',
  'collection_lookup_succeeded',
  'collection_lookup_failed',
  'verified_dates_shown',
  'reminders_enabled',
  'reminders_disabled',
  'guide_search_matched',
  'guide_search_no_match',
  'guide_result_selected',
  'local_services_succeeded',
  'local_services_failed',
  'missed_report_eligible',
  'missed_report_route_opened',
  'council_submission_confirmed',
] as const;

export type PilotAnalyticsEventName = typeof pilotAnalyticsEventNames[number];
export type PilotAnalyticsConsent = 'unknown' | 'granted' | 'declined';
type PlatformName = 'ios' | 'android' | 'web';
type PilotEvent = {
  id: string;
  name: PilotAnalyticsEventName;
  occurredAt: string;
  councilId?: string;
  platform: PlatformName;
  appVersion: string;
  outcome?: string;
  context?: string;
  reasonCode?: string;
  durationMs?: number;
  metricValue?: number;
};
type StoredAnalytics = {
  consent: PilotAnalyticsConsent;
  participantId?: string;
  pendingDeletionId?: string;
  queue: PilotEvent[];
};
type TrackInput = Omit<PilotEvent, 'id' | 'name' | 'occurredAt' | 'platform' | 'appVersion'>;
type PilotAnalyticsContextValue = {
  consent: PilotAnalyticsConsent;
  enabled: boolean;
  ready: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  syncCouncilLinks: (councilIds: string[]) => Promise<void>;
  track: (name: PilotAnalyticsEventName, input?: TrackInput) => void;
  eraseAnalytics: (resetChoice?: boolean) => Promise<void>;
};

const storageKey = '@what-bin-is-it-tonight/pilot-analytics-v1';
const consentVersion = '2026-07-27';
const validEventNames = new Set<string>(pilotAnalyticsEventNames);
const validPlatforms = new Set(['ios', 'android', 'web']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const councilIdPattern = /^[a-z0-9][a-z0-9-]{2,79}$/;
const configuredApiBase = process.env.EXPO_PUBLIC_COUNCIL_API_BASE?.replace(/\/$/, '');
const apiBase = configuredApiBase
  || (Platform.OS === 'web' && typeof globalThis.location?.origin === 'string'
    ? `${globalThis.location.origin}/api`
    : 'https://what-bin-is-it-tonight.vercel.app/api');

const PilotAnalyticsContext = createContext<PilotAnalyticsContextValue | undefined>(undefined);

function platformName(): PlatformName {
  return validPlatforms.has(Platform.OS) ? Platform.OS as PlatformName : 'web';
}

function initialState(): StoredAnalytics {
  return { consent: 'unknown', queue: [] };
}

function validStoredEvent(value: unknown): value is PilotEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<PilotEvent>;
  return (
    typeof event.id === 'string'
    && uuidPattern.test(event.id)
    && typeof event.name === 'string'
    && validEventNames.has(event.name)
    && typeof event.occurredAt === 'string'
    && !Number.isNaN(Date.parse(event.occurredAt))
    && typeof event.platform === 'string'
    && validPlatforms.has(event.platform)
    && typeof event.appVersion === 'string'
  );
}

function hydrate(value: unknown): StoredAnalytics {
  if (!value || typeof value !== 'object') return initialState();
  const stored = value as Partial<StoredAnalytics>;
  const consent = stored.consent === 'granted' || stored.consent === 'declined'
    ? stored.consent
    : 'unknown';
  const participantId = typeof stored.participantId === 'string' && uuidPattern.test(stored.participantId)
    ? stored.participantId
    : undefined;
  const pendingDeletionId = typeof stored.pendingDeletionId === 'string' && uuidPattern.test(stored.pendingDeletionId)
    ? stored.pendingDeletionId
    : undefined;
  return {
    consent: consent === 'granted' && !participantId ? 'unknown' : consent,
    participantId,
    pendingDeletionId,
    queue: Array.isArray(stored.queue) ? stored.queue.filter(validStoredEvent).slice(-100) : [],
  };
}

async function sendDeletion(participantId: string) {
  const response = await fetch(`${apiBase}/analytics/participant`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ participantId }),
  });
  if (!response.ok && response.status !== 404) throw new Error('Analytics deletion could not be confirmed.');
}

export function PilotAnalyticsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredAnalytics>(initialState);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  const flushing = useRef(false);
  const councilSyncSequence = useRef<Promise<void>>(Promise.resolve());

  const updateState = useCallback((next: StoredAnalytics) => {
    stateRef.current = next;
    setState(next);
    return AsyncStorage.setItem(storageKey, JSON.stringify(next));
  }, []);

  const flush = useCallback(async function flushQueuedEvents() {
    if (flushing.current) return;
    const current = stateRef.current;
    if (current.consent !== 'granted' || !current.participantId || !current.queue.length) return;
    flushing.current = true;
    const batch = current.queue.slice(0, 25);
    try {
      const response = await fetch(`${apiBase}/analytics/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          participantId: current.participantId,
          consentVersion,
          events: batch,
        }),
      });
      if (!response.ok) return;
      const sentIds = new Set(batch.map((event) => event.id));
      const latest = stateRef.current;
      if (latest.participantId !== current.participantId) return;
      await updateState({
        ...latest,
        queue: latest.queue.filter((event) => !sentIds.has(event.id)),
      });
    } catch {
      // The small, allow-listed queue remains on this device for a later retry.
    } finally {
      flushing.current = false;
    }
    if (stateRef.current.queue.length) void flushQueuedEvents();
  }, [updateState]);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(storageKey)
      .then((stored) => hydrate(stored ? JSON.parse(stored) : undefined))
      .catch(() => initialState())
      .then(async (next) => {
        if (cancelled) return;
        if (next.pendingDeletionId) {
          try {
            await sendDeletion(next.pendingDeletionId);
            next.pendingDeletionId = undefined;
          } catch {
            // Retain the deletion request locally and retry on the next launch.
          }
        }
        stateRef.current = next;
        setState(next);
        setReady(true);
        await AsyncStorage.setItem(storageKey, JSON.stringify(next));
        if (next.consent === 'granted') void flush();
      });
    return () => {
      cancelled = true;
    };
  }, [flush]);

  const track = useCallback((name: PilotAnalyticsEventName, input: TrackInput = {}) => {
    const current = stateRef.current;
    if (current.consent !== 'granted' || !current.participantId) return;
    const next: StoredAnalytics = {
      ...current,
      queue: [
        ...current.queue,
        {
          id: Crypto.randomUUID(),
          name,
          occurredAt: new Date().toISOString(),
          platform: platformName(),
          appVersion: Constants.expoConfig?.version ?? 'unknown',
          ...input,
        },
      ].slice(-100),
    };
    void updateState(next).then(() => flush());
  }, [flush, updateState]);

  const syncCouncilLinks = useCallback(async (councilIds: string[]) => {
    const normalisedCouncilIds = [...new Set(
      councilIds.filter((councilId) => councilIdPattern.test(councilId)),
    )].sort().slice(0, 10);
    councilSyncSequence.current = councilSyncSequence.current
      .catch(() => undefined)
      .then(async () => {
        const current = stateRef.current;
        if (current.consent !== 'granted' || !current.participantId) return;
        const response = await fetch(`${apiBase}/analytics/council-links`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            participantId: current.participantId,
            consentVersion,
            councilIds: normalisedCouncilIds,
          }),
        });
        if (!response.ok) {
          throw new Error('Council adoption evidence could not be updated.');
        }
      });
    return councilSyncSequence.current;
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    const current = stateRef.current;
    if (enabled) {
      const participantId = current.participantId ?? Crypto.randomUUID();
      const consentEvent: PilotEvent = {
        id: Crypto.randomUUID(),
        name: 'analytics_consent_granted',
        occurredAt: new Date().toISOString(),
        platform: platformName(),
        appVersion: Constants.expoConfig?.version ?? 'unknown',
        outcome: 'enabled',
      };
      const next: StoredAnalytics = {
        consent: 'granted',
        participantId,
        queue: [
          ...current.queue,
          consentEvent,
        ].slice(-100),
      };
      await updateState(next);
      void flush();
      return;
    }
    const participantId = current.participantId;
    const next: StoredAnalytics = {
      consent: 'declined',
      queue: [],
      pendingDeletionId: participantId,
    };
    await updateState(next);
    if (!participantId) return;
    try {
      await sendDeletion(participantId);
      await updateState({ consent: 'declined', queue: [] });
    } catch {
      // Keep the deletion ID, but analytics is already disabled locally.
    }
  }, [flush, updateState]);

  const eraseAnalytics = useCallback(async (resetChoice = false) => {
    const current = stateRef.current;
    const participantId = current.participantId ?? current.pendingDeletionId;
    const next: StoredAnalytics = {
      consent: resetChoice ? 'unknown' : 'declined',
      queue: [],
      pendingDeletionId: participantId,
    };
    await updateState(next);
    if (participantId) {
      try {
        await sendDeletion(participantId);
      } catch {
        return;
      }
    }
    const cleared = { consent: next.consent, queue: [] } as StoredAnalytics;
    if (resetChoice) {
      stateRef.current = cleared;
      setState(cleared);
      await AsyncStorage.removeItem(storageKey);
    } else {
      await updateState(cleared);
    }
  }, [updateState]);

  const value = useMemo<PilotAnalyticsContextValue>(() => ({
    consent: state.consent,
    enabled: state.consent === 'granted',
    ready,
    setEnabled,
    syncCouncilLinks,
    track,
    eraseAnalytics,
  }), [eraseAnalytics, ready, setEnabled, state.consent, syncCouncilLinks, track]);

  return <PilotAnalyticsContext.Provider value={value}>{children}</PilotAnalyticsContext.Provider>;
}

export function usePilotAnalytics() {
  const value = useContext(PilotAnalyticsContext);
  if (!value) throw new Error('usePilotAnalytics must be used inside PilotAnalyticsProvider.');
  return value;
}
