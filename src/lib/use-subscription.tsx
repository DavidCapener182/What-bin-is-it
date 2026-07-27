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
  identifySubscriptionUser,
  listenForSubscriptionChanges,
  presentSubscriptionManagement,
  presentSubscriptionPaywall,
  restoreSubscriptionPurchases,
  unavailableSubscriptionSnapshot,
} from '@/lib/subscriptions';
import { useAccount } from '@/lib/use-account';

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
  const account = useAccount();
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot>(unavailableSubscriptionSnapshot);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    let stopListening = () => undefined;

    void configureSubscriptionClient()
      .then(async (next) => {
        if (!active) return;
        const identified = next.configured
          ? await identifySubscriptionUser(account.user?.id)
          : next;
        if (!active) return;
        setSnapshot(identified);
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
  }, [account.user?.id]);

  const run = useCallback(async (operation: () => Promise<SubscriptionSnapshot>) => {
    setBusy(true);
    setError(undefined);
    try {
      setSnapshot(await operation());
      await account.refreshEntitlement();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }, [account]);

  const showPaywall = useCallback(() => run(presentSubscriptionPaywall), [run]);
  const restore = useCallback(() => run(restoreSubscriptionPurchases), [run]);
  const manage = useCallback(() => run(presentSubscriptionManagement), [run]);

  const value = useMemo<SubscriptionContextValue>(() => ({
    ...snapshot,
    // The native SDK is useful purchase UI, but only the reconciled server
    // entitlement can unlock resident features.
    isPlus: account.entitlement.isPlus,
    productIdentifier: snapshot.productIdentifier ?? account.entitlement.productId ?? account.entitlement.planId,
    expirationDate: snapshot.expirationDate ?? account.entitlement.currentPeriodEnd,
    ready,
    busy,
    error,
    showPaywall,
    restore,
    manage,
  }), [account.entitlement, busy, error, manage, ready, restore, showPaywall, snapshot]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return value;
}
