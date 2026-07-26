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
  SubscriptionSnapshot,
  configureSubscriptionClient,
  listenForSubscriptionChanges,
  presentSubscriptionManagement,
  presentSubscriptionPaywall,
  restoreSubscriptionPurchases,
  unavailableSubscriptionSnapshot,
} from '@/lib/subscriptions';

type SubscriptionContextValue = SubscriptionSnapshot & {
  ready: boolean;
  busy: boolean;
  error?: string;
  showPaywall: () => Promise<void>;
  restore: () => Promise<void>;
  manage: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : 'The store could not be reached. Please try again.';
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot>(unavailableSubscriptionSnapshot);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    let stopListening = () => undefined;

    void configureSubscriptionClient()
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        stopListening = listenForSubscriptionChanges(setSnapshot);
      })
      .catch((caught) => {
        if (!active) return;
        setError(messageFor(caught));
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
      stopListening();
    };
  }, []);

  const run = useCallback(async (operation: () => Promise<SubscriptionSnapshot>) => {
    setBusy(true);
    setError(undefined);
    try {
      setSnapshot(await operation());
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  const showPaywall = useCallback(() => run(presentSubscriptionPaywall), [run]);
  const restore = useCallback(() => run(restoreSubscriptionPurchases), [run]);
  const manage = useCallback(() => run(presentSubscriptionManagement), [run]);

  const value = useMemo<SubscriptionContextValue>(() => ({
    ...snapshot,
    ready,
    busy,
    error,
    showPaywall,
    restore,
    manage,
  }), [busy, error, manage, ready, restore, showPaywall, snapshot]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return value;
}
