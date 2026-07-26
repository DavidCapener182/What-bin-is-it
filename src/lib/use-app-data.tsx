import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

import { fetchCollectionsForAddress } from '@/lib/council-provider';
import { makeSampleCollections, sortCollections } from '@/lib/data';
import { rescheduleCollectionReminders } from '@/lib/notifications';
import { Collection, NotificationPreferences, SavedAddress, WasteType } from '@/lib/types';

const storageKey = '@uk-bin-app/state-v1';

const starterAddress: SavedAddress = {
  id: 'starter-home', label: 'Home', line1: '14 Cedar Grove', postcode: 'M1 1AE', councilName: 'Your local council', providerId: 'gateway', isPrimary: true,
};

const defaultPreferences: NotificationPreferences = {
  enabled: false, reminderHour: 19, reminderDayOffset: 1,
  wasteTypes: { general: true, recycling: true, garden: true, food: true },
};

type State = { addresses: SavedAddress[]; activeAddressId: string; collections: Collection[]; preferences: NotificationPreferences; sourceStatus: string };
type AppDataContextValue = {
  addresses: SavedAddress[]; activeAddress?: SavedAddress; collections: Collection[]; preferences: NotificationPreferences; sourceStatus: string; ready: boolean; refreshing: boolean;
  setActiveAddress: (id: string) => void; addAddress: (address: Omit<SavedAddress, 'id' | 'isPrimary'>) => void; updatePreferences: (next: Partial<NotificationPreferences>) => void; toggleWasteType: (type: WasteType) => void; refreshCollections: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

function buildInitialState(): State {
  return { addresses: [starterAddress], activeAddressId: starterAddress.id, collections: makeSampleCollections(), preferences: defaultPreferences, sourceStatus: 'Sample schedule · connect your council to verify' };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(buildInitialState);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((saved) => {
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<State>;
        setState((current) => ({ ...current, ...parsed, collections: parsed.collections?.length ? sortCollections(parsed.collections) : current.collections }));
      }
    }).catch(() => undefined).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => undefined);
  }, [ready, state]);

  const activeAddress = state.addresses.find((address) => address.id === state.activeAddressId);

  const value = useMemo<AppDataContextValue>(() => ({
    ...state,
    activeAddress,
    ready,
    refreshing,
    setActiveAddress: (id) => setState((current) => ({ ...current, activeAddressId: id })),
    addAddress: (address) => setState((current) => {
      const id = `address-${Date.now()}`;
      const next = { ...address, id, isPrimary: current.addresses.length === 0 };
      return { ...current, addresses: [...current.addresses, next], activeAddressId: id };
    }),
    updatePreferences: (next) => setState((current) => ({ ...current, preferences: { ...current.preferences, ...next } })),
    toggleWasteType: (type) => setState((current) => ({ ...current, preferences: { ...current.preferences, wasteTypes: { ...current.preferences.wasteTypes, [type]: !current.preferences.wasteTypes[type] } } })),
    refreshCollections: async () => {
      if (!activeAddress) return;
      setRefreshing(true);
      try {
        const result = await fetchCollectionsForAddress(activeAddress);
        const collections = sortCollections(result.collections);
        setState((current) => ({ ...current, collections, sourceStatus: `Verified by ${result.councilName} · updated just now` }));
        await rescheduleCollectionReminders(collections, state.preferences);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'We could not refresh your collection schedule.';
        setState((current) => ({ ...current, sourceStatus: message }));
      } finally {
        setRefreshing(false);
      }
    },
  }), [activeAddress, ready, refreshing, state]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}
