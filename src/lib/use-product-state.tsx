import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  reschedulePlannedReminders,
  syncCouncilAlertRegistration,
} from '@/lib/notifications';
import { planPlaceCollectionReminders, PlannedReminder } from '@/lib/reminder-plan';
import { missedReportPolicy } from '@/lib/council-reporting';
import {
  ActivityEntry,
  AppearancePreference,
  Collection,
  CollectionOutcome,
  CollectionOutcomeStatus,
  CouncilNoticePreferenceState,
  DisruptionAlert,
  IncorrectDataFeedback,
  MissedCollectionReport,
  PlaceReminderPreferences,
  SavedAddress,
  SupportRequest,
  WasteType,
} from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { syncCollectionLiveSurface } from '@/widgets/collection-live-surface';
import { buildCollectionLiveSurfaceSnapshot } from '@/widgets/collection-live-surface-data';

const storageKey = '@what-bin-is-it-tonight/product-state-v1';

export const defaultPlaceReminders: PlaceReminderPreferences = {
  enabled: false,
  reminderHour: 19,
  reminderMinute: 0,
  reminderDayOffset: 1,
  morningReminder: false,
  morningHour: 7,
  secondReminder: false,
  secondReminderHour: 21,
  collectionFollowUp: true,
  collectionChangeAlerts: true,
  disruptionAlerts: true,
  recollectionAlerts: true,
  wasteTypes: { general: true, recycling: true, garden: true, food: true, other: true },
};

type OnboardingState = {
  completed: boolean;
  skipped: boolean;
};

type ProductState = {
  appearance: AppearancePreference;
  showSponsoredServices: boolean;
  liveCollectionSurfaceEnabled: boolean;
  savedGuideItemIds: string[];
  onboarding: OnboardingState;
  reminderPreferencesByAddressId: Record<string, PlaceReminderPreferences>;
  outcomes: CollectionOutcome[];
  reports: MissedCollectionReport[];
  disruptions: DisruptionAlert[];
  history: ActivityEntry[];
  incorrectFeedback: IncorrectDataFeedback[];
  supportRequests: SupportRequest[];
  councilNotices: CouncilNoticePreferenceState;
  reportStatusSeenById: Record<string, string>;
  supportSeenMessageIdByThreadId: Record<string, string>;
};

type ProductContextValue = ProductState & {
  ready: boolean;
  setAppearance: (appearance: AppearancePreference) => void;
  setShowSponsoredServices: (enabled: boolean) => void;
  setLiveCollectionSurfaceEnabled: (enabled: boolean) => void;
  toggleSavedGuideItem: (itemId: string) => void;
  completeOnboarding: () => void;
  skipOnboarding: () => void;
  reminderPreferencesFor: (addressId?: string) => PlaceReminderPreferences;
  updatePlaceReminders: (addressId: string, next: Partial<PlaceReminderPreferences>) => void;
  outcomeFor: (addressId: string | undefined, collection: Collection | undefined) => CollectionOutcome | undefined;
  markCollection: (
    address: SavedAddress,
    collection: Collection,
    status: CollectionOutcomeStatus,
  ) => CollectionOutcome;
  saveReport: (report: MissedCollectionReport) => void;
  updateReport: (id: string, next: Partial<MissedCollectionReport>) => void;
  replaceDisruptions: (addressId: string, alerts: DisruptionAlert[]) => void;
  saveIncorrectFeedback: (feedback: Omit<IncorrectDataFeedback, 'id' | 'createdAt'>) => void;
  saveSupportRequest: (request: Omit<SupportRequest, 'id' | 'createdAt'>) => void;
  markCouncilNoticeRead: (noticeId: string) => void;
  markCouncilNoticesRead: (noticeIds: string[]) => void;
  archiveCouncilNotice: (noticeId: string) => void;
  setCouncilNoticesMuted: (providerId: string, muted: boolean) => void;
  markReportStatusSeen: (reportId: string, status: string) => void;
  markSupportThreadSeen: (threadId: string, messageId: string) => void;
  clearProductData: () => Promise<void>;
};

const ProductContext = createContext<ProductContextValue | undefined>(undefined);

function initialState(): ProductState {
  return {
    appearance: 'system',
    showSponsoredServices: true,
    liveCollectionSurfaceEnabled: false,
    savedGuideItemIds: [],
    onboarding: { completed: false, skipped: false },
    reminderPreferencesByAddressId: {},
    outcomes: [],
    reports: [],
    disruptions: [],
    history: [],
    incorrectFeedback: [],
    supportRequests: [],
    councilNotices: { readAtById: {}, archivedAtById: {}, mutedProviderIds: [] },
    reportStatusSeenById: {},
    supportSeenMessageIdByThreadId: {},
  };
}

function timestamp() {
  return new Date().toISOString();
}

function recordId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function validAppearance(value: unknown): AppearancePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function validBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function validHour(value: unknown, fallback: number) {
  return typeof value === 'number' && value >= 0 && value <= 23 ? Math.round(value) : fallback;
}

function validMinute(value: unknown, fallback: number) {
  return typeof value === 'number' && value >= 0 && value <= 59 ? Math.round(value) : fallback;
}

function normaliseReminderPreferences(value: unknown): PlaceReminderPreferences {
  if (!value || typeof value !== 'object') return defaultPlaceReminders;
  const raw = value as Partial<PlaceReminderPreferences>;
  const wasteTypes = raw.wasteTypes;
  return {
    enabled: validBoolean(raw.enabled, false),
    reminderHour: validHour(raw.reminderHour, 19),
    reminderMinute: validMinute(raw.reminderMinute, 0),
    reminderDayOffset: raw.reminderDayOffset === 0 ? 0 : 1,
    morningReminder: validBoolean(raw.morningReminder, false),
    morningHour: validHour(raw.morningHour, 7),
    secondReminder: validBoolean(raw.secondReminder, false),
    secondReminderHour: validHour(raw.secondReminderHour, 21),
    collectionFollowUp: validBoolean(raw.collectionFollowUp, true),
    collectionChangeAlerts: validBoolean(raw.collectionChangeAlerts, true),
    disruptionAlerts: validBoolean(raw.disruptionAlerts, true),
    recollectionAlerts: validBoolean(raw.recollectionAlerts, true),
    wasteTypes: {
      general: validBoolean(wasteTypes?.general, true),
      recycling: validBoolean(wasteTypes?.recycling, true),
      garden: validBoolean(wasteTypes?.garden, true),
      food: validBoolean(wasteTypes?.food, true),
      other: validBoolean(wasteTypes?.other, true),
    },
  };
}

function safeArray<T>(value: unknown, guard: (item: unknown) => item is T, limit = 300): T[] {
  return Array.isArray(value) ? value.filter(guard).slice(0, limit) : [];
}

function isOutcome(value: unknown): value is CollectionOutcome {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CollectionOutcome>;
  return (
    typeof item.id === 'string'
    && typeof item.addressId === 'string'
    && typeof item.collectionId === 'string'
    && typeof item.collectionDate === 'string'
    && ['general', 'recycling', 'garden', 'food', 'other'].includes(item.wasteType as WasteType)
    && ['put-out', 'collected', 'missed', 'brought-in'].includes(item.status as CollectionOutcomeStatus)
    && typeof item.updatedAt === 'string'
  );
}

function hasStringId(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string');
}

function safeStringRecord(value: unknown, limit = 500) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value)
    .filter(([key, item]) => key.length > 0 && key.length <= 220 && typeof item === 'string')
    .slice(0, limit)
    .reduce<Record<string, string>>((result, [key, item]) => {
      result[key] = item as string;
      return result;
    }, {});
}

function hydrate(value: unknown): ProductState {
  const fallback = initialState();
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Partial<ProductState>;
  const rawPreferences = raw.reminderPreferencesByAddressId && typeof raw.reminderPreferencesByAddressId === 'object'
    ? raw.reminderPreferencesByAddressId
    : {};
  const reminderPreferencesByAddressId = Object.entries(rawPreferences).reduce<Record<string, PlaceReminderPreferences>>(
    (result, [addressId, preferences]) => {
      if (addressId.length > 0 && addressId.length <= 120) {
        result[addressId] = normaliseReminderPreferences(preferences);
      }
      return result;
    },
    {},
  );
  return {
    appearance: validAppearance(raw.appearance),
    showSponsoredServices: validBoolean(raw.showSponsoredServices, true),
    liveCollectionSurfaceEnabled: validBoolean(raw.liveCollectionSurfaceEnabled, false),
    savedGuideItemIds: Array.isArray(raw.savedGuideItemIds)
      ? raw.savedGuideItemIds.filter((item): item is string => typeof item === 'string' && item.length <= 120).slice(0, 100)
      : [],
    onboarding: {
      completed: validBoolean(raw.onboarding?.completed, false),
      skipped: validBoolean(raw.onboarding?.skipped, false),
    },
    reminderPreferencesByAddressId,
    outcomes: safeArray(raw.outcomes, isOutcome),
    reports: safeArray(raw.reports, hasStringId) as MissedCollectionReport[],
    disruptions: safeArray(raw.disruptions, hasStringId) as DisruptionAlert[],
    history: safeArray(raw.history, hasStringId, 500) as ActivityEntry[],
    incorrectFeedback: safeArray(raw.incorrectFeedback, hasStringId) as IncorrectDataFeedback[],
    supportRequests: safeArray(raw.supportRequests, hasStringId) as SupportRequest[],
    councilNotices: {
      readAtById: safeStringRecord(raw.councilNotices?.readAtById),
      archivedAtById: safeStringRecord(raw.councilNotices?.archivedAtById),
      mutedProviderIds: Array.isArray(raw.councilNotices?.mutedProviderIds)
        ? raw.councilNotices.mutedProviderIds.filter((item): item is string => typeof item === 'string').slice(0, 100)
        : [],
    },
    reportStatusSeenById: safeStringRecord(raw.reportStatusSeenById),
    supportSeenMessageIdByThreadId: safeStringRecord(raw.supportSeenMessageIdByThreadId),
  };
}

function activity(type: ActivityEntry['type'], title: string, addressId?: string, detail?: string): ActivityEntry {
  return { id: recordId('activity'), addressId, type, title, detail, occurredAt: timestamp() };
}

export function ProductStateProvider({ children }: { children: ReactNode }) {
  const {
    addresses,
    activeAddress,
    schedulesByAddressId,
    ready: appDataReady,
  } = useAppData();
  const [state, setState] = useState<ProductState>(initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((stored) => setState(hydrate(stored ? JSON.parse(stored) : undefined)))
      .catch(() => setState(initialState()))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => undefined);
  }, [ready, state]);

  useEffect(() => {
    if (!ready || !appDataReady) return;
    const now = new Date();
    const plans = addresses.map((address) => {
      const preferences = state.reminderPreferencesByAddressId[address.id] ?? defaultPlaceReminders;
      const answeredCollectionIds = new Set(
        state.outcomes
          .filter((outcome) => (
            outcome.addressId === address.id
            && ['collected', 'missed', 'brought-in'].includes(outcome.status)
          ))
          .map((outcome) => `${address.id}:${outcome.collectionId}`),
      );
      const putOutCollectionIds = new Set(
        state.outcomes
          .filter((outcome) => outcome.addressId === address.id && outcome.status === 'put-out')
          .map((outcome) => `${address.id}:${outcome.collectionId}`),
      );
      const reportPolicy = missedReportPolicy(address);
      return {
        preferences: {
          ...preferences,
          followUpHour: reportPolicy.eligibleHour,
          followUpMinute: reportPolicy.eligibleMinute,
          followUpDayOffset: reportPolicy.eligibleDayOffset,
          presentationTime: reportPolicy.presentationTime,
        },
        answeredCollectionIds,
        putOutCollectionIds,
        collections: (schedulesByAddressId[address.id]?.collections ?? []).map((collection) => ({
          ...collection,
          id: `${address.id}:${collection.id}`,
          placeLabel: address.label || address.line1,
        })),
      };
    });
    const lifecycleAlerts = addresses.flatMap((address): PlannedReminder[] => {
      const preferences = state.reminderPreferencesByAddressId[address.id] ?? defaultPlaceReminders;
      if (!preferences.enabled) return [];
      const schedule = schedulesByAddressId[address.id];
      const alerts: PlannedReminder[] = [];
      if (preferences.collectionChangeAlerts && schedule?.changeNotice && schedule.lastVerifiedAt) {
        const triggerAt = new Date(new Date(schedule.lastVerifiedAt).getTime() + 15_000);
        if (triggerAt > now) {
          alerts.push({
            id: `${address.id}:date-change:${schedule.lastVerifiedAt}`,
            collectionId: `${address.id}:date-change`,
            triggerAt,
            title: 'Collection date changed',
            body: `${address.label}: ${schedule.changeNotice.replace(/^Collection date changed · /, '')}`.slice(0, 180),
            url: '/schedule',
          });
        }
      }
      [...(schedule?.disruptions ?? []), ...state.disruptions.filter((alert) => alert.addressId === address.id)]
        .filter((alert, index, alerts) => alerts.findIndex((candidate) => candidate.id === alert.id) === index)
        .forEach((alert) => {
          if (preferences.disruptionAlerts) {
            const triggerAt = new Date(new Date(alert.verifiedAt).getTime() + 15_000);
            if (triggerAt > now) {
              alerts.push({
                id: `${address.id}:disruption:${alert.id}:${alert.verifiedAt}`,
                collectionId: `${address.id}:disruption`,
                triggerAt,
                title: alert.title,
                body: alert.detail.slice(0, 180),
                url: '/',
              });
            }
          }
          if (preferences.recollectionAlerts && alert.expectedRecollectionDate) {
            const triggerAt = new Date(`${alert.expectedRecollectionDate}T19:00:00`);
            triggerAt.setDate(triggerAt.getDate() - 1);
            if (triggerAt > now) {
              alerts.push({
                id: `${address.id}:recollection:${alert.id}:${alert.expectedRecollectionDate}`,
                collectionId: `${address.id}:recollection`,
                triggerAt,
                title: 'Recollection scheduled',
                body: `${address.label}: leave the affected bin out for collection tomorrow.`,
                url: '/',
              });
            }
          }
        });
      if (preferences.recollectionAlerts) {
        state.reports
          .filter((report) => (
            report.addressId === address.id
            && report.expectedRecollectionDate
            && !['resolved', 'rejected', 'cancelled', 'closed'].includes(report.status)
          ))
          .forEach((report) => {
            const triggerAt = new Date(`${report.expectedRecollectionDate}T${String(preferences.reminderHour).padStart(2, '0')}:${String(preferences.reminderMinute).padStart(2, '0')}:00`);
            triggerAt.setDate(triggerAt.getDate() - 1);
            if (triggerAt <= now) return;
            alerts.push({
              id: `${address.id}:report-recollection:${report.id}:${report.expectedRecollectionDate}`,
              collectionId: `${address.id}:report-recollection`,
              triggerAt,
              title: 'Recollection due tomorrow',
              body: `${address.label}: leave the ${report.binLabel.toLowerCase()} out for the council.`,
              url: '/activity',
            });
          });
      }
      return alerts;
    });
    const reminders = [...planPlaceCollectionReminders(plans, now), ...lifecycleAlerts]
      .sort((left, right) => left.triggerAt.getTime() - right.triggerAt.getTime())
      .slice(0, 48);
    const enabled = plans.some((plan) => plan.preferences.enabled);
    void reschedulePlannedReminders(reminders, enabled).catch(() => undefined);
  }, [
    addresses,
    appDataReady,
    ready,
    schedulesByAddressId,
    state.outcomes,
    state.reports,
    state.disruptions,
    state.reminderPreferencesByAddressId,
  ]);

  useEffect(() => {
    if (!ready || !appDataReady) return;
    const snapshot = state.liveCollectionSurfaceEnabled
      ? buildCollectionLiveSurfaceSnapshot(
          activeAddress,
          activeAddress ? schedulesByAddressId[activeAddress.id]?.collections ?? [] : [],
          state.outcomes,
        )
      : undefined;
    void syncCollectionLiveSurface(snapshot).catch(() => undefined);
  }, [
    activeAddress,
    appDataReady,
    ready,
    schedulesByAddressId,
    state.liveCollectionSurfaceEnabled,
    state.outcomes,
  ]);

  useEffect(() => {
    if (!ready || !appDataReady) return;
    const subscriptions = [...new Set(addresses
      .filter((address) => {
        const preferences = state.reminderPreferencesByAddressId[address.id] ?? defaultPlaceReminders;
        return Boolean(address.providerId && preferences.enabled && preferences.disruptionAlerts);
      })
      .map((address) => address.providerId))]
      .map((councilId) => {
        const collections = addresses
          .filter((address) => address.providerId === councilId)
          .flatMap((address) => schedulesByAddressId[address.id]?.collections ?? []);
        return {
          councilId,
          collectionTypes: [...new Set(collections.map((collection) => collection.wasteType))],
          collectionDates: [...new Set(collections.map((collection) => collection.date))]
            .sort()
            .slice(0, 24),
        };
      });
    void syncCouncilAlertRegistration(subscriptions, subscriptions.length > 0).catch(() => undefined);
  }, [
    addresses,
    appDataReady,
    ready,
    schedulesByAddressId,
    state.reminderPreferencesByAddressId,
  ]);

  const markCollection = useCallback((
    address: SavedAddress,
    collection: Collection,
    status: CollectionOutcomeStatus,
  ) => {
    const next: CollectionOutcome = {
      id: `${address.id}:${collection.id}`,
      addressId: address.id,
      collectionId: collection.id,
      collectionDate: collection.date,
      wasteType: collection.wasteType,
      status,
      updatedAt: timestamp(),
    };
    const activityByStatus: Record<CollectionOutcomeStatus, [ActivityEntry['type'], string]> = {
      'put-out': ['bin-put-out', `${collection.label ?? 'Bin'} marked as put out`],
      collected: ['collection-confirmed', `${collection.label ?? 'Collection'} confirmed collected`],
      missed: ['missed-collection', `${collection.label ?? 'Collection'} marked as missed`],
      'brought-in': ['collection-confirmed', `${collection.label ?? 'Bin'} brought in`],
    };
    setState((current) => ({
      ...current,
      outcomes: [...current.outcomes.filter((item) => item.id !== next.id), next],
      history: [
        activity(activityByStatus[status][0], activityByStatus[status][1], address.id, collection.date),
        ...current.history,
      ].slice(0, 500),
    }));
    return next;
  }, []);

  const value = useMemo<ProductContextValue>(() => ({
    ...state,
    ready,
    setAppearance: (appearance) => setState((current) => ({ ...current, appearance })),
    setShowSponsoredServices: (showSponsoredServices) => setState((current) => ({ ...current, showSponsoredServices })),
    setLiveCollectionSurfaceEnabled: (liveCollectionSurfaceEnabled) => setState((current) => ({ ...current, liveCollectionSurfaceEnabled })),
    toggleSavedGuideItem: (itemId) => setState((current) => ({
      ...current,
      savedGuideItemIds: current.savedGuideItemIds.includes(itemId)
        ? current.savedGuideItemIds.filter((savedId) => savedId !== itemId)
        : [...current.savedGuideItemIds, itemId].slice(-100),
    })),
    completeOnboarding: () => setState((current) => ({
      ...current,
      onboarding: { completed: true, skipped: false },
    })),
    skipOnboarding: () => setState((current) => ({
      ...current,
      onboarding: { completed: false, skipped: true },
    })),
    reminderPreferencesFor: (addressId) => (
      addressId ? state.reminderPreferencesByAddressId[addressId] ?? defaultPlaceReminders : defaultPlaceReminders
    ),
    updatePlaceReminders: (addressId, next) => setState((current) => ({
      ...current,
      reminderPreferencesByAddressId: {
        ...current.reminderPreferencesByAddressId,
        [addressId]: {
          ...(current.reminderPreferencesByAddressId[addressId] ?? defaultPlaceReminders),
          ...next,
          wasteTypes: next.wasteTypes
            ? {
                ...(current.reminderPreferencesByAddressId[addressId]?.wasteTypes ?? defaultPlaceReminders.wasteTypes),
                ...next.wasteTypes,
              }
            : (current.reminderPreferencesByAddressId[addressId]?.wasteTypes ?? defaultPlaceReminders.wasteTypes),
        },
      },
    })),
    outcomeFor: (addressId, collection) => (
      addressId && collection
        ? state.outcomes.find((outcome) => (
            outcome.addressId === addressId && outcome.collectionId === collection.id
          ))
        : undefined
    ),
    markCollection,
    saveReport: (report) => setState((current) => ({
      ...current,
      reports: [report, ...current.reports.filter((item) => item.id !== report.id)],
      history: [
        activity('report-opened', `Missed ${report.binLabel.toLowerCase()} report started`, report.addressId, report.localTrackingId),
        ...current.history,
      ].slice(0, 500),
    })),
    updateReport: (id, next) => setState((current) => ({
      ...current,
      reports: current.reports.map((report) => report.id === id
        ? { ...report, ...next, updatedAt: timestamp() }
        : report),
      history: [
        activity('report-updated', 'Missed collection report updated', current.reports.find((report) => report.id === id)?.addressId, id),
        ...current.history,
      ].slice(0, 500),
    })),
    replaceDisruptions: (addressId, alerts) => setState((current) => ({
      ...current,
      disruptions: [...current.disruptions.filter((alert) => alert.addressId !== addressId), ...alerts],
    })),
    saveIncorrectFeedback: (feedback) => setState((current) => {
      const saved: IncorrectDataFeedback = { ...feedback, id: recordId('feedback'), createdAt: timestamp() };
      return {
        ...current,
        incorrectFeedback: [saved, ...current.incorrectFeedback],
        history: [activity('feedback-saved', 'Incorrect collection data feedback saved', feedback.addressId), ...current.history].slice(0, 500),
      };
    }),
    saveSupportRequest: (request) => setState((current) => ({
      ...current,
      supportRequests: [{ ...request, id: recordId('support'), createdAt: timestamp() }, ...current.supportRequests],
    })),
    markCouncilNoticeRead: (noticeId) => setState((current) => ({
      ...current,
      councilNotices: {
        ...current.councilNotices,
        readAtById: { ...current.councilNotices.readAtById, [noticeId]: timestamp() },
      },
    })),
    markCouncilNoticesRead: (noticeIds) => setState((current) => {
      const readAt = timestamp();
      return {
        ...current,
        councilNotices: {
          ...current.councilNotices,
          readAtById: noticeIds.reduce<Record<string, string>>(
            (result, noticeId) => ({ ...result, [noticeId]: readAt }),
            current.councilNotices.readAtById,
          ),
        },
      };
    }),
    archiveCouncilNotice: (noticeId) => setState((current) => ({
      ...current,
      councilNotices: {
        ...current.councilNotices,
        archivedAtById: { ...current.councilNotices.archivedAtById, [noticeId]: timestamp() },
        readAtById: { ...current.councilNotices.readAtById, [noticeId]: timestamp() },
      },
    })),
    setCouncilNoticesMuted: (providerId, muted) => setState((current) => ({
      ...current,
      councilNotices: {
        ...current.councilNotices,
        mutedProviderIds: muted
          ? [...new Set([...current.councilNotices.mutedProviderIds, providerId])]
          : current.councilNotices.mutedProviderIds.filter((item) => item !== providerId),
      },
    })),
    markReportStatusSeen: (reportId, status) => setState((current) => ({
      ...current,
      reportStatusSeenById: { ...current.reportStatusSeenById, [reportId]: status },
    })),
    markSupportThreadSeen: (threadId, messageId) => setState((current) => ({
      ...current,
      supportSeenMessageIdByThreadId: {
        ...current.supportSeenMessageIdByThreadId,
        [threadId]: messageId,
      },
    })),
    clearProductData: async () => {
      await AsyncStorage.removeItem(storageKey);
      setState(initialState());
    },
  }), [markCollection, ready, state]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProductState() {
  const context = useContext(ProductContext);
  if (!context) throw new Error('useProductState must be used inside ProductStateProvider');
  return context;
}
