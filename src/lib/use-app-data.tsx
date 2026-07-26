import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { verifiedCollectionsOnly } from '@/lib/collection-safety';
import { fetchCollectionsForAddress } from '@/lib/council-provider';
import { sortCollections } from '@/lib/data';
import { rescheduleCollectionReminders } from '@/lib/notifications';
import { matchingAddressId, normalisePostcode } from '@/lib/place-resolution';
import { Collection, NotificationPreferences, SavedAddress, WasteType } from '@/lib/types';

const storageKey = '@what-bin-is-it-tonight/state-v3';
const previousStorageKey = '@what-bin-is-it-tonight/state-v2';
const legacyStorageKey = '@uk-bin-app/state-v1';
const startStatus = 'Add your postcode or use your location to get verified council dates.';
const emptyStatus = 'No verified collection dates yet · refresh to check this council.';
const migratedStatus = 'Saved place restored · select this postcode again to choose your exact address.';

const defaultPreferences: NotificationPreferences = {
  enabled: false,
  reminderHour: 19,
  reminderDayOffset: 1,
  wasteTypes: { general: true, recycling: true, garden: true, food: true },
};

type AddressSchedule = { collections: Collection[]; sourceStatus: string };
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
  activeAddress?: SavedAddress;
  collections: Collection[];
  preferences: NotificationPreferences;
  sourceStatus: string;
  ready: boolean;
  refreshing: boolean;
  setActiveAddress: (id: string) => void;
  addAddress: (address: Omit<SavedAddress, 'id' | 'isPrimary'>) => Promise<CollectionRefreshOutcome>;
  updatePreferences: (next: Partial<NotificationPreferences>) => void;
  toggleWasteType: (type: WasteType) => void;
  refreshCollections: () => Promise<CollectionRefreshOutcome | undefined>;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

function buildInitialState(): State {
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

function normalisePreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== 'object') return defaultPreferences;
  const preferences = value as Partial<NotificationPreferences>;
  const storedWasteTypes = preferences.wasteTypes;
  return {
    enabled: typeof preferences.enabled === 'boolean' ? preferences.enabled : defaultPreferences.enabled,
    reminderHour: typeof preferences.reminderHour === 'number' && preferences.reminderHour >= 0 && preferences.reminderHour <= 23
      ? Math.round(preferences.reminderHour)
      : defaultPreferences.reminderHour,
    reminderDayOffset: preferences.reminderDayOffset === 0 ? 0 : 1,
    wasteTypes: {
      general: typeof storedWasteTypes?.general === 'boolean' ? storedWasteTypes.general : true,
      recycling: typeof storedWasteTypes?.recycling === 'boolean' ? storedWasteTypes.recycling : true,
      garden: typeof storedWasteTypes?.garden === 'boolean' ? storedWasteTypes.garden : true,
      food: typeof storedWasteTypes?.food === 'boolean' ? storedWasteTypes.food : true,
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

async function loadState() {
  const entries = await AsyncStorage.multiGet([storageKey, previousStorageKey, legacyStorageKey]);
  const current = entries[0]?.[1];
  const previous = entries[1]?.[1];
  const legacy = entries[2]?.[1];
  try {
    if (current) return hydrateCurrent(JSON.parse(current));
  } catch {
    // Ignore corrupt local state and try the previous format before using defaults.
  }
  try {
    if (previous) return migrateUnverifiedState(JSON.parse(previous));
  } catch {
    // Previous builds could contain generated dates, so only saved places are migrated.
  }
  try {
    if (legacy) return migrateUnverifiedState(JSON.parse(legacy));
  } catch {
    // Ignore corrupt legacy state and start without an address or schedule.
  }
  return undefined;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(buildInitialState);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadState()
      .then((saved) => saved && setState(saved))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => undefined);
  }, [ready, state]);

  const activeAddress = state.addresses.find((address) => address.id === state.activeAddressId);
  const activeSchedule = state.schedulesByAddressId[state.activeAddressId]
    ?? { collections: [], sourceStatus: activeAddress ? emptyStatus : startStatus };

  useEffect(() => {
    if (!ready) return;
    void rescheduleCollectionReminders(activeSchedule.collections, state.preferences).catch(() => undefined);
  }, [activeSchedule.collections, ready, state.activeAddressId, state.preferences]);

  const refreshAddress = useCallback(async (targetAddress: SavedAddress, clearExisting: boolean): Promise<CollectionRefreshOutcome> => {
    setRefreshing(true);
    if (clearExisting) {
      setState((current) => ({
        ...current,
        schedulesByAddressId: {
          ...current.schedulesByAddressId,
          [targetAddress.id]: {
            collections: [],
            sourceStatus: `${targetAddress.councilName} found · checking live collection dates…`,
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
          [targetAddress.id]: { collections, sourceStatus },
        },
      }));
      return { verified: true, message: sourceStatus };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not refresh your collection schedule.';
      setState((current) => ({
        ...current,
        schedulesByAddressId: {
          ...current.schedulesByAddressId,
          [targetAddress.id]: {
            collections: clearExisting
              ? []
              : current.schedulesByAddressId[targetAddress.id]?.collections ?? [],
            sourceStatus: message,
          },
        },
      }));
      return { verified: false, message };
    } finally {
      setRefreshing(false);
    }
  }, []);

  const addAddress = useCallback(async (address: Omit<SavedAddress, 'id' | 'isPrimary'>) => {
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
          },
        },
      };
    });

    return refreshAddress(targetAddress, true);
  }, [refreshAddress, state.addresses]);

  const value = useMemo<AppDataContextValue>(() => ({
    addresses: state.addresses,
    activeAddress,
    collections: activeSchedule.collections,
    preferences: state.preferences,
    sourceStatus: activeSchedule.sourceStatus,
    ready,
    refreshing,
    setActiveAddress: (id) => setState((current) => (
      current.addresses.some((address) => address.id === id)
        ? { ...current, activeAddressId: id }
        : current
    )),
    addAddress,
    updatePreferences: (next) => setState((current) => ({
      ...current,
      preferences: { ...current.preferences, ...next },
    })),
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
  }), [activeAddress, activeSchedule.collections, activeSchedule.sourceStatus, addAddress, ready, refreshAddress, refreshing, state.addresses, state.preferences]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}
