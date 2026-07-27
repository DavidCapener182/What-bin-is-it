import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { apiBase } from '@/lib/api-base';
import {
  AccountEntitlement,
  EntitlementSource,
  freeEntitlement,
  isEntitlementPlan,
} from '@/lib/entitlements';
import { accountServiceConfigured, supabase } from '@/lib/supabase-client';

type AccountContextValue = {
  configured: boolean;
  ready: boolean;
  busy: boolean;
  user?: User;
  accessToken?: string;
  entitlement: AccountEntitlement;
  error?: string;
  message?: string;
  sendSignInLink: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
};

type EntitlementResponse = {
  entitlement?: {
    planId?: unknown;
    source?: unknown;
    status?: unknown;
    productId?: unknown;
    currentPeriodEnd?: unknown;
    isPlus?: unknown;
  };
  error?: string;
};

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : 'The account service could not be reached.';
}

function normaliseEntitlement(payload: EntitlementResponse['entitlement']): AccountEntitlement {
  if (!payload || !isEntitlementPlan(payload.planId)) return freeEntitlement;
  const source: EntitlementSource = (
    payload.source === 'stripe'
    || payload.source === 'apple'
    || payload.source === 'google'
    || payload.source === 'admin'
  ) ? payload.source : 'free';
  return {
    planId: payload.planId,
    source,
    status: typeof payload.status === 'string' ? payload.status : 'free',
    productId: typeof payload.productId === 'string' ? payload.productId : undefined,
    currentPeriodEnd: typeof payload.currentPeriodEnd === 'string' ? payload.currentPeriodEnd : undefined,
    isPlus: payload.isPlus === true,
  };
}

async function acceptNativeSession(url: string) {
  if (!supabase || Platform.OS === 'web') return;
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const fragment = url.includes('#') ? new URLSearchParams(url.split('#')[1]) : undefined;
  const accessToken = fragment?.get('access_token');
  const refreshToken = fragment?.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return;
  }
  const tokenHash = typeof query.token_hash === 'string' ? query.token_hash : undefined;
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (error) throw error;
  }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [entitlement, setEntitlement] = useState<AccountEntitlement>(freeEntitlement);
  const [ready, setReady] = useState(!accountServiceConfigured);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const loadEntitlement = useCallback(async (activeSession: Session | null) => {
    if (!activeSession) {
      setEntitlement(freeEntitlement);
      return;
    }
    const response = await fetch(`${apiBase}/account/entitlement`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${activeSession.access_token}`,
      },
    });
    const payload = await response.json() as EntitlementResponse;
    if (!response.ok) throw new Error(payload.error ?? 'Your plan could not be checked.');
    setEntitlement(normaliseEntitlement(payload.entitlement));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession()
      .then(async ({ data, error: sessionError }) => {
        if (sessionError) throw sessionError;
        if (!active) return;
        setSession(data.session);
        await loadEntitlement(data.session);
      })
      .catch((caught) => {
        if (active) setError(messageFor(caught));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setError(undefined);
      void loadEntitlement(nextSession).catch((caught) => {
        if (active) setError(messageFor(caught));
      });
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadEntitlement]);

  useEffect(() => {
    if (!supabase || Platform.OS === 'web') return;
    const client = supabase;
    const handleUrl = ({ url }: { url: string }) => {
      void acceptNativeSession(url).catch((caught) => setError(messageFor(caught)));
    };
    const subscription = Linking.addEventListener('url', handleUrl);
    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    return () => {
      subscription.remove();
      appState.remove();
    };
  }, []);

  const sendSignInLink = useCallback(async (rawEmail: string) => {
    if (!supabase) {
      setError('Account sign-in is not configured in this build.');
      return false;
    }
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Enter a valid email address.');
      return false;
    }
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const emailRedirectTo = Platform.OS === 'web'
        ? `${globalThis.location?.origin ?? 'https://what-bin-is-it-tonight.vercel.app'}/account`
        : Linking.createURL('/account');
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo, shouldCreateUser: true },
      });
      if (signInError) throw signInError;
      setMessage('Check your email and tap the secure sign-in link. It expires after one hour.');
      return true;
    } catch (caught) {
      setError(messageFor(caught));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    setError(undefined);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setSession(null);
      setEntitlement(freeEntitlement);
      setMessage('Signed out. The free bin-day features still work on this device.');
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshEntitlement = useCallback(async () => {
    setBusy(true);
    setError(undefined);
    try {
      await loadEntitlement(session);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }, [loadEntitlement, session]);

  const value = useMemo<AccountContextValue>(() => ({
    configured: accountServiceConfigured,
    ready,
    busy,
    user: session?.user,
    accessToken: session?.access_token,
    entitlement,
    error,
    message,
    sendSignInLink,
    signOut,
    refreshEntitlement,
  }), [
    busy,
    entitlement,
    error,
    message,
    ready,
    refreshEntitlement,
    sendSignInLink,
    session,
    signOut,
  ]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountProvider');
  return value;
}
