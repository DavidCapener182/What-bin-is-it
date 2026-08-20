import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { verifiedCollectionsOnly } from '@/lib/collection-safety';
import { fetchCollectionsForAddress } from '@/lib/council-provider';
import { sortCollections } from '@/lib/data';
import { removeAddressFromState } from '@/lib/address-state';
import { eraseDataQualityClientId } from '@/lib/data-quality-client';
import { matchingAddressId, normalisePostcode } from '@/lib/place-resolution';
import {
  nativeE2EFixtureAddress,
  nativeE2EFixtureCollections,
  nativeE2EFixturesEnabled,
} from '@/lib/native-e2e-fixtures';
import { councilIdsForResidentUse } from '@/lib/resident-adoption';
import { eraseResidentCouncilRecord, syncResidentCouncilLinks } from '@/lib/resident-council-links';
import { Collection, DisruptionAlert, NotificationPreferences, SavedAddress, WasteType } from '@/lib/types';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';
import { syncHomeScreenWidget } from '@/widgets/home-screen-widget-sync';

const storageKey = '@what-bin-is-it-tonight/state-v4';
const previousStorageKey = '@what-bin-is-it-tonight/state-v3';
const olderStorageKey = '@what-bin-is-it-tonight/state-v2';
const legacyStorageKey = '@uk-bin-app/state-v1';
const startStatus = 'Add your postcode or use your location to get verified council dates.';
const emptyStatus = 'No verified collection dates yet · refresh to check this council.';
const migratedStatus = 'Saved place restored · select this postcode again to choose your exact address.';
const collectionMetadataVersion = 1;

const defaultPreferences: NotificationPreferences = {
  enabled: false,
  reminderHour: 19,
  reminderMinute: 0,
  reminderDayOffset: 1,
  wasteTypes: { general: true, recycling: true, garden: true, food: true, other: true },
};

export type AddressSchedule = {
  collections: Collection[];
  sourceStatus: string;
  metadataVersion?: number;
  lastVerifiedAt?: string;
  lastError?: string;
  completedDate?: string;
  changeNotice?: string;
  disruptions?: DisruptionAlert[];
};
export type CollectionDataState = 'no-address' | 'ready' | 'refreshing' | 'cached' | 'empty' | 'error';
type State = {
  addresses: SavedAddress[];
  activeAddressId: string;
  schedulesByAddressId: Record<string, AddressSchedule>;
  preferences: NotificationPreferences;
};
type LegacyState = {
  addresses?: SavedAddress[];
  activeAddressId?: string;
  collections?: Collection[];
  preferences?: NotificationPreferences;
  sourceStatus?: string;
};
export type CollectionRefreshOutcome = {
  verified: boolean;
  message: string;
};
type AppDataContextValue = {
  addresses: SavedAddress[];
  schedulesByAddressId: Record<string, AddressSchedule>;
  activeAddress?: SavedAddress;
  collections: Collection[];
  preferences: NotificationPreferences;
  sourceStatus: string;
  collectionDataState: CollectionDataState;
  lastVerifiedAt?: string;
  lastError?: string;
  completedDate?: string;
  changeNotice?: string;
  disruptions: DisruptionAlert[];
  ready: boolean;
  refreshing: boolean;
  setActiveAddress: (id: string) => void;
  removeAddress: (id: string) => void;
  addAddress: (address: Omit<SavedAddress, 'id' | 'isPrimary'>) => Promise<CollectionRefreshOutcome>;
  updatePreferences: (next: Partial<NotificationPreferences>) => void;
  toggleWasteType: (type: WasteType) => void;
  refreshCollections: () => Promise<CollectionRefreshOutcome | undefined>;
  markCollectionDateComplete: (date: string) => void;
  clearAllAppData: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

function buildInitialState(): State {
  if (nativeE2EFixturesEnabled()) {
    const collections = nativeE2EFixtureCollections();
    return {
      addresses: [nativeE2EFixtureAddress],
      activeAddressId: nativeE2EFixtureAddress.id,
      schedulesByAddressId: {
        [nativeE2EFixtureAddress.id]: {
          collections,
          sourceStatus: 'Internal proof fixture · no production lookup',
          metadataVersion: collectionMetadataVersion,
          lastVerifiedAt: new Date().toISOString(),
        },
      },
      preferences: defaultPreferences,
    };
  }
  return {
    addresses: [],
    activeAddressId: '',
    schedulesByAddressId: {},
    preferences: defaultPreferences,
  };
}

function isSavedAddress(value: unknown): value is SavedAddress {
  if (!value || typeof value !== 'object') return false;
  const address = value as Partial<SavedAddress>;
  return (
    typeof address.id === 'string' && address.id.length > 0 && address.id.length <= 120
    && typeof address.label === 'string' && address.label.length > 0 && address.label.length <= 120
    && typeof address.line1 === 'string' && address.line1.length > 0 && address.line1.length <= 240
    && typeof address.postcode === 'string' && address.postcode.length <= 12
    && typeof address.councilName === 'string' && address.councilName.length <= 160
    && typeof address.providerId === 'string' && address.providerId.length <= 120
    && (address.councilAddressId === undefined || (
      typeof address.councilAddressId === 'string'
      && address.councilAddressId.length > 0
      && address.councilAddressId.length <= 120
    ))
  );
}

function validCollections(value: unknown): Collection[] {
  return sortCollections(verifiedCollectionsOnly(value));
}

function validDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : undefined;
}

function validTimestamp(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? value
    : undefined;
}

function validDisruptions(value: unknown, addressId: string): DisruptionAlert[] {
  if (!Array.isArray(value)) return [];
  return value.filter((alert): alert is DisruptionAlert => (
    Boolean(alert)
    && typeof alert === 'object'
    && typeof alert.id === 'string'
    && typeof alert.title === 'string'
    && typeof alert.detail === 'string'
    && typeof alert.sourceUrl === 'string'
    && alert.sourceUrl.startsWith('https://')
    && typeof alert.startsAt === 'string'
    && !Number.isNaN(Date.parse(alert.startsAt))
    && typeof alert.verifiedAt === 'string'
    && !Number.isNaN(Date.parse(alert.verifiedAt))
  )).slice(0, 20).map((alert) => ({ ...alert, addressId }));
}

function normalisePreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== 'object') return defaultPreferences;
  const preferences = value as Partial<NotificationPreferences>;
  const storedWasteTypes = preferences.wasteTypes;
  return {
    enabled: typeof preferences.enabled === 'boolean' ? preferences.enabled : defaultPreferences.enabled,
    reminderHour: typeof preferences.reminderHour === 'number' && preferences.reminderHour >= 0 && preferences.reminderHour <= 23
      ? Math.round(preferences.reminderHour)
      : defaultPreferences.reminderHour,
    reminderMinute: typeof preferences.reminderMinute === 'number' && preferences.reminderMinute >= 0 && preferences.reminderMinute <= 59
      ? Math.round(preferences.reminderMinute)
      : defaultPreferences.reminderMinute,
    reminderDayOffset: preferences.reminderDayOffset === 0 ? 0 : 1,
    wasteTypes: {
      general: typeof storedWasteTypes?.general === 'boolean' ? storedWasteTypes.general : true,
      recycling: typeof storedWasteTypes?.recycling === 'boolean' ? storedWasteTypes.recycling : true,
      garden: typeof storedWasteTypes?.garden === 'boolean' ? storedWasteTypes.garden : true,
      food: typeof storedWasteTypes?.food === 'boolean' ? storedWasteTypes.food : true,
      other: typeof storedWasteTypes?.other === 'boolean' ? storedWasteTypes.other : true,
    },
  };
}

function normaliseAddresses(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const addresses = value.filter((item): item is SavedAddress => {
    if (!isSavedAddress(item) || item.id === 'starter-home' || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).map((address, index) => ({
    ...address,
    label: address.label === 'New place' ? address.councilName : address.label,
    line1: address.line1
      .replace(/,\s*unparished area$/i, '')
      .replace(/\bunparished area\b/gi, '')
      .replace(/,\s*$/, '')
      .trim() || address.councilName,
    postcode: normalisePostcode(address.postcode),
    isPrimary: index === 0,
    councilAddressId: typeof address.councilAddressId === 'string' ? address.councilAddressId : undefined,
    latitude: typeof address.latitude === 'number' && Number.isFinite(address.latitude) && address.latitude >= -90 && address.latitude <= 90
      ? address.latitude
      : undefined,
    longitude: typeof address.longitude === 'number' && Number.isFinite(address.longitude) && address.longitude >= -180 && address.longitude <= 180
      ? address.longitude
      : undefined,
  }));
  return addresses;
}

function hydrateCurrent(value: unknown): State | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const stored = value as Partial<State>;
  const addresses = normaliseAddresses(stored.addresses);
  const activeAddressId = addresses.some((address) => address.id === stored.activeAddressId)
    ? stored.activeAddressId as string
    : addresses[0]?.id ?? '';
  const rawSchedules = stored.schedulesByAddressId && typeof stored.schedulesByAddressId === 'object'
    ? stored.schedulesByAddressId
    : {};
  const schedulesByAddressId = addresses.reduce<Record<string, AddressSchedule>>((result, address) => {
    const rawSchedule = rawSchedules[address.id] as Partial<AddressSchedule> | undefined;
    const collections = validCollections(rawSchedule?.collections);
    result[address.id] = {
      collections,
      sourceStatus: typeof rawSchedule?.sourceStatus === 'string'
        ? rawSchedule.sourceStatus.slice(0, 240)
        : emptyStatus,
      metadataVersion: rawSchedule?.metadataVersion === collectionMetadataVersion
        ? collectionMetadataVersion
        : undefined,
      lastVerifiedAt: validTimestamp(rawSchedule?.lastVerifiedAt),
      lastError: typeof rawSchedule?.lastError === 'string'
        ? rawSchedule.lastError.slice(0, 240)
        : undefined,
      completedDate: validDate(rawSchedule?.completedDate),
      changeNotice: typeof rawSchedule?.changeNotice === 'string'
        ? rawSchedule.changeNotice.slice(0, 240)
        : undefined,
      disruptions: validDisruptions(rawSchedule?.disruptions, address.id),
    };
    return result;
  }, {});
  return { addresses, activeAddressId, schedulesByAddressId, preferences: normalisePreferences(stored.preferences) };
}

function migrateUnverifiedState(value: unknown): State | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const stored = value as LegacyState;
  const addresses = normaliseAddresses(stored.addresses);
  const activeAddressId = addresses.some((address) => address.id === stored.activeAddressId)
    ? stored.activeAddressId as string
    : addresses[0]?.id ?? '';
  const schedulesByAddressId = addresses.reduce<Record<string, AddressSchedule>>((result, address) => {
    result[address.id] = {
      collections: [],
      sourceStatus: migratedStatus,
    };
    return result;
  }, {});
  return { addresses, activeAddressId, schedulesByAddressId, preferences: normalisePreferences(stored.preferences) };
}

function verifiedSourceStatus(councilName: string, verifiedAt: string) {
  const date = new Date(verifiedAt);
  if (Number.isNaN(date.getTime())) return `Verified by ${councilName}`;
  const checked = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return `Verified by ${councilName} · checked ${checked}`;
}

function collectionChangeNotice(previous: Collection[], next: Collection[]) {
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const futurePrevious = sortCollections(previous).filter((collection) => collection.date >= todayKey);
  const futureNext = sortCollections(next).filter((collection) => collection.date >= todayKey);
  const changed = (['general', 'recycling', 'garden', 'food', 'other'] as WasteType[]).flatMap((wasteType) => {
    const oldDate = futurePrevious.find((collection) => collection.wasteType === wasteType)?.date;
    const newDate = futureNext.find((collection) => collection.wasteType === wasteType)?.date;
    if (!oldDate || !newDate || oldDate === newDate) return [];
    const label = futureNext.find((collection) => collection.wasteType === wasteType)?.label?.trim()
      || (wasteType === 'general'
        ? 'General waste'
        : wasteType === 'recycling'
          ? 'Recycling'
          : wasteType === 'garden'
            ? 'Garden waste'
            : wasteType === 'food'
              ? 'Food waste'
              : 'Council bin');
    const date = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${newDate}T12:00:00`));
    return [`${label} is now ${date}`];
  });
  return changed.length ? `Collection date changed · ${changed.slice(0, 2).join(' · ')}` : undefined;
}

async function loadState() {
  if (nativeE2EFixturesEnabled()) return buildInitialState();
  const entries = await AsyncStorage.multiGet([storageKey, previousStorageKey, olderStorageKey, legacyStorageKey]);
  const current = entries[0]?.[1];
  const previous = entries[1]?.[1];
  const older = entries[2]?.[1];
  const legacy = entries[3]?.[1];
  try {
    if (current) return hydrateCurrent(JSON.parse(current));
  } catch {
    // Ignore corrupt local state and try the previous format before using defaults.
  }
  try {
    if (previous) return hydrateCurrent(JSON.parse(previous));
  } catch {
    // Ignore corrupt v3 state and try the older unverified formats.
  }
  try {
    if (older) return migrateUnverifiedState(JSON.parse(older));
  } catch {
    // Older builds could contain generated dates, so only saved places are migrated.
  }
  try {
    if (legacy) return migrateUnverifiedState(JSON.parse(legacy));
  } catch {
    // Ignore corrupt legacy state and start without an address or schedule.
  }
  return undefined;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const {
    eraseAnalytics,
    syncCouncilWorkspaces,
    track,
  } = usePilotAnalytics();
  const [state, setState] = useState<State>(buildInitialState);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const autoRefreshAttempts = useRef(new Set<string>());

  useEffect(() => {
    loadState()
      .then((saved) => saved && setState(saved))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const activeAddress = state.addresses.find((address) => address.id === state.activeAddressId);
    const collections = state.schedulesByAddressId[state.activeAddressId]?.collections ?? [];
    AsyncStorage.setItem(storageKey, JSON.stringify(state))
      .then(() => syncHomeScreenWidget({ address: activeAddress, collections }))
      .catch(() => undefined);
  }, [ready, state]);

  const syncSavedCouncilLinks = useCallback(async () => {
    if (!ready) return;
    const councilIds = councilIdsForResidentUse(
      state.addresses.map((address) => address.providerId),
    );
    await Promise.all([
      syncCouncilWorkspaces(councilIds),
      syncResidentCouncilLinks(councilIds),
    ]);
  }, [
    ready,
    state.addresses,
    syncCouncilWorkspaces,
  ]);

  useEffect(() => {
    void syncSavedCouncilLinks().catch(() => {
      // Reopening the installed app, relaunching or changing a saved place retries the sync.
    });
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void syncSavedCouncilLinks().catch(() => {
          // Keep the local resident experience independent from optional evidence collection.
        });
      }
    });
    return () => subscription.remove();
  }, [syncSavedCouncilLinks]);

  const activeAddress = state.addresses.find((address) => address.id === state.activeAddressId);
  const activeSchedule = state.schedulesByAddressId[state.activeAddressId]
    ?? { collections: [], sourceStatus: activeAddress ? emptyStatus : startStatus };
  const collectionDataState: CollectionDataState = !activeAddress
    ? 'no-address'
    : refreshing
      ? 'refreshing'
      : activeSchedule.collections.length > 0 && activeSchedule.lastError
        ? 'cached'
        : activeSchedule.collections.length > 0
          ? 'ready'
          : activeSchedule.lastError
            ? 'error'
            : 'empty';
  const refreshAddress = useCallback(async (targetAddress: SavedAddress, clearExisting: boolean): Promise<CollectionRefreshOutcome> => {
    const startedAt = Date.now();
    track('collection_lookup_started', {
      councilId: targetAddress.providerId,
      context: clearExisting ? 'address-add' : 'refresh',
    });
    setRefreshing(true);
    if (clearExisting) {
      setState((current) => ({
        ...current,
        schedulesByAddressId: {
          ...current.schedulesByAddressId,
          [targetAddress.id]: {
            collections: [],
            sourceStatus: `${targetAddress.councilName} found · checking live collection dates…`,
            lastError: undefined,
            disruptions: [],
          },
        },
      }));
    }
    try {
      const result = await fetchCollectionsForAddress(targetAddress);
      const collections = sortCollections(result.collections);
      const sourceStatus = result.notice?.trim()
        || verifiedSourceStatus(result.councilName, result.verifiedAt);
      setState((current) => ({
        ...current,
        schedulesByAddressId: {
          ...current.schedulesByAddressId,
          [targetAddress.id]: {
            ...current.schedulesByAddressId[targetAddress.id],
            collections,
            sourceStatus,
            metadataVersion: collectionMetadataVersion,
            lastVerifiedAt: result.verifiedAt,
            lastError: undefined,
            changeNotice: collectionChangeNotice(
              current.schedulesByAddressId[targetAddress.id]?.collections ?? [],
              collections,
            ),
            disruptions: (result.alerts ?? []).map((alert) => ({
              ...alert,
              addressId: targetAddress.id,
            })),
          },
        },
      }));
      track('collection_lookup_succeeded', {
        councilId: targetAddress.providerId,
        context: clearExisting ? 'address-add' : 'refresh',
        outcome: 'success',
        durationMs: Math.min(120_000, Date.now() - startedAt),
        metricValue: Math.min(1000, collections.length),
      });
      track('verified_dates_shown', {
        councilId: targetAddress.providerId,
        outcome: 'success',
      });
      return { verified: true, message: sourceStatus };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not refresh your collection schedule.';
      setState((current) => ({
        ...current,
        schedulesByAddressId: {
          ...current.schedulesByAddressId,
          [targetAddress.id]: {
            ...current.schedulesByAddressId[targetAddress.id],
            collections: clearExisting
              ? []
              : current.schedulesByAddressId[targetAddress.id]?.collections ?? [],
            sourceStatus: clearExisting
              ? message
              : current.schedulesByAddressId[targetAddress.id]?.sourceStatus ?? message,
            lastError: message,
          },
        },
      }));
      track('collection_lookup_failed', {
        councilId: targetAddress.providerId,
        context: clearExisting ? 'address-add' : 'refresh',
        outcome: 'failure',
        durationMs: Math.min(120_000, Date.now() - startedAt),
        reasonCode: /not found|no dated|no collection/i.test(message)
          ? 'not-found'
          : /timed out|too long/i.test(message)
            ? 'timeout'
            : /not connected|unsupported/i.test(message)
              ? 'unsupported'
              : 'unavailable',
      });
      return { verified: false, message };
    } finally {
      setRefreshing(false);
    }
  }, [track]);

  useEffect(() => {
    const metadataNeedsRefresh = (
      activeSchedule.collections.length > 0
      && activeSchedule.metadataVersion !== collectionMetadataVersion
    );
    if (
      !ready
      || !activeAddress?.councilAddressId
      || (activeSchedule.collections.length > 0 && !metadataNeedsRefresh)
      || autoRefreshAttempts.current.has(activeAddress.id)
    ) return;
    autoRefreshAttempts.current.add(activeAddress.id);
    void refreshAddress(activeAddress, false);
  }, [
    activeAddress,
    activeSchedule.collections.length,
    activeSchedule.metadataVersion,
    ready,
    refreshAddress,
  ]);

  const addAddress = useCallback(async (address: Omit<SavedAddress, 'id' | 'isPrimary'>) => {
    if (address.councilAddressId) {
      track('exact_address_selected', {
        councilId: address.providerId,
        context: 'exact-address',
        outcome: 'success',
      });
    }
    const exactExisting = address.councilAddressId
      ? state.addresses.find((savedAddress) => (
          savedAddress.providerId === address.providerId
          && savedAddress.councilAddressId === address.councilAddressId
        ))
      : undefined;
    const postcodeExisting = state.addresses.find((savedAddress) => (
      !savedAddress.councilAddressId
      && savedAddress.id === matchingAddressId(state.addresses, address.postcode)
    ));
    const existing = exactExisting ?? postcodeExisting;
    const targetAddress: SavedAddress = {
      ...existing,
      ...address,
      id: existing?.id ?? `address-${(address.councilAddressId || address.postcode).replace(/[^A-Z0-9]/gi, '').toLowerCase()}`,
      isPrimary: existing?.isPrimary ?? state.addresses.length === 0,
    };

    setState((current) => {
      const currentExistingIndex = current.addresses.findIndex((savedAddress) => (
        targetAddress.councilAddressId
          ? (
              savedAddress.providerId === targetAddress.providerId
              && savedAddress.councilAddressId === targetAddress.councilAddressId
            ) || (
              !savedAddress.councilAddressId
              && savedAddress.id === matchingAddressId(current.addresses, targetAddress.postcode)
            )
          : savedAddress.id === matchingAddressId(current.addresses, targetAddress.postcode)
      ));
      const resolvedTarget = currentExistingIndex >= 0
        ? {
            ...current.addresses[currentExistingIndex],
            ...targetAddress,
            id: current.addresses[currentExistingIndex].id,
            isPrimary: current.addresses[currentExistingIndex].isPrimary,
          }
        : targetAddress;
      const addresses = currentExistingIndex >= 0
        ? current.addresses.map((savedAddress, index) => index === currentExistingIndex ? resolvedTarget : savedAddress)
        : [...current.addresses, resolvedTarget];
      return {
        ...current,
        addresses,
        activeAddressId: resolvedTarget.id,
        schedulesByAddressId: {
          ...current.schedulesByAddressId,
          [resolvedTarget.id]: {
            collections: [],
            sourceStatus: `${resolvedTarget.councilName} found · checking live collection dates…`,
            lastError: undefined,
          },
        },
      };
    });

    autoRefreshAttempts.current.add(targetAddress.id);
    return refreshAddress(targetAddress, true);
  }, [refreshAddress, state.addresses, track]);

  const value = useMemo<AppDataContextValue>(() => ({
    addresses: state.addresses,
    schedulesByAddressId: state.schedulesByAddressId,
    activeAddress,
    collections: activeSchedule.collections,
    preferences: state.preferences,
    sourceStatus: activeSchedule.sourceStatus,
    collectionDataState,
    lastVerifiedAt: activeSchedule.lastVerifiedAt,
    lastError: activeSchedule.lastError,
    completedDate: activeSchedule.completedDate,
    changeNotice: activeSchedule.changeNotice,
    disruptions: activeSchedule.disruptions ?? [],
    ready,
    refreshing,
    setActiveAddress: (id) => setState((current) => (
      current.addresses.some((address) => address.id === id)
        ? { ...current, activeAddressId: id }
        : current
    )),
    removeAddress: (id) => setState((current) => removeAddressFromState(current, id)),
    addAddress,
    updatePreferences: (next) => setState((current) => {
      if (
        typeof next.enabled === 'boolean'
        && next.enabled !== current.preferences.enabled
      ) {
        track(next.enabled ? 'reminders_enabled' : 'reminders_disabled', {
          councilId: activeAddress?.providerId,
          outcome: next.enabled ? 'enabled' : 'disabled',
        });
      }
      return {
        ...current,
        preferences: { ...current.preferences, ...next },
      };
    }),
    toggleWasteType: (type) => setState((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        wasteTypes: {
          ...current.preferences.wasteTypes,
          [type]: !current.preferences.wasteTypes[type],
        },
      },
    })),
    refreshCollections: async () => {
      if (!activeAddress) return;
      return refreshAddress(activeAddress, false);
    },
    markCollectionDateComplete: (date) => {
      if (!state.activeAddressId || !validDate(date)) return;
      setState((current) => {
        const schedule = current.schedulesByAddressId[current.activeAddressId];
        if (!schedule) return current;
        return {
          ...current,
          schedulesByAddressId: {
            ...current.schedulesByAddressId,
            [current.activeAddressId]: {
              ...schedule,
              completedDate: date,
            },
          },
        };
      });
    },
    clearAllAppData: async () => {
      await Promise.all([
        eraseAnalytics(true),
        eraseDataQualityClientId(),
        eraseResidentCouncilRecord().catch(() => undefined),
      ]);
      await AsyncStorage.multiRemove([storageKey, previousStorageKey, olderStorageKey, legacyStorageKey]);
      setState(buildInitialState());
      autoRefreshAttempts.current.clear();
    },
  }), [
    activeAddress,
    activeSchedule.collections,
    activeSchedule.completedDate,
    activeSchedule.changeNotice,
    activeSchedule.disruptions,
    activeSchedule.lastError,
    activeSchedule.lastVerifiedAt,
    activeSchedule.sourceStatus,
    addAddress,
    collectionDataState,
    eraseAnalytics,
    ready,
    refreshAddress,
    refreshing,
    state.activeAddressId,
    state.addresses,
    state.schedulesByAddressId,
    state.preferences,
    track,
  ]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}
