import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { fetchBoundedResponseJson } from '@/lib/bounded-response';
import {
  AccountEntitlement,
  EntitlementSource,
  freeEntitlement,
  isEntitlementPlan,
} from '@/lib/entitlements';
import { accountServiceConfigured, supabase } from '@/lib/supabase-client';
import { presentAccountExport } from '@/features/account/account-export';
import { readBrowserAccountFixture } from '@/features/account/browser-account-fixture';

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
  preparePlusReEnrolment: () => Promise<void>;
  exportAccountData: () => Promise<void>;
  removeAccountData: () => Promise<boolean>;
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

type AccountDataRemovalResponse = {
  removed?: boolean;
  identityRetained?: boolean;
  code?: unknown;
  error?: unknown;
  guidance?: unknown;
  retryable?: unknown;
  retained?: unknown;
  requestId?: unknown;
};

class AccountDataRemovalRequestError extends Error {}

const AccountContext = createContext<AccountContextValue | undefined>(undefined);
const signInCooldownKey = 'what-bin:account:last-sign-in-request';
const signInCooldownMs = 60_000;

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
  const [browserFixture] = useState(readBrowserAccountFixture);
  const [session, setSession] = useState<Session | null>(browserFixture ?? null);
  const [entitlement, setEntitlement] = useState<AccountEntitlement>(freeEntitlement);
  const [ready, setReady] = useState(Boolean(browserFixture) || !accountServiceConfigured);
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
    if (browserFixture || !supabase) return;
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
  }, [browserFixture, loadEntitlement]);

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
      const previousRequest = Number(await AsyncStorage.getItem(signInCooldownKey));
      const remaining = signInCooldownMs - (Date.now() - previousRequest);
      if (Number.isFinite(previousRequest) && previousRequest > 0 && remaining > 0) {
        throw new Error(`Please wait ${Math.ceil(remaining / 1000)} seconds before requesting another link.`);
      }
      const emailRedirectTo = Platform.OS === 'web'
        ? `${globalThis.location?.origin ?? 'https://what-bin-is-it-tonight.vercel.app'}/account`
        : Linking.createURL('/account');
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo, shouldCreateUser: true },
      });
      if (signInError) throw signInError;
      await AsyncStorage.setItem(signInCooldownKey, String(Date.now()));
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
    if (!supabase || browserFixture) {
      if (browserFixture) {
        setSession(null);
        setEntitlement(freeEntitlement);
        setMessage('Signed out. The free bin-day features still work on this device.');
      }
      return;
    }
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
  }, [browserFixture]);

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

  const preparePlusReEnrolment = useCallback(async () => {
    if (!session) throw new Error('Sign in before buying or restoring What Bin Plus.');
    const response = await fetch(`${apiBase}/account/re-enrol`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${session.access_token}`,
        'x-bin-confirm-re-enrol': 'plus-purchase-or-restore',
      },
    });
    const payload = await response.json().catch(() => ({})) as {
      intentRecorded?: unknown;
      error?: unknown;
    };
    if (!response.ok || payload.intentRecorded !== true) {
      throw new Error(typeof payload.error === 'string'
        ? payload.error
        : 'What Bin re-enrolment could not be prepared right now.');
    }
  }, [session]);

  const exportAccountData = useCallback(async () => {
    if (!session) {
      setError('Sign in before exporting your account data.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const { response, payload } = await fetchBoundedResponseJson(
        `${apiBase}/account/export`,
        {
          init: {
            headers: {
              accept: 'application/json',
              authorization: `Bearer ${session.access_token}`,
            },
          },
          maximumBytes: 8 * 1024 * 1024,
          timeoutMs: 30_000,
        },
      );
      const accountExport = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown> & { error?: unknown }
        : undefined;
      if (!response.ok || !accountExport) {
        const publicError = typeof accountExport?.error === 'string'
          ? accountExport.error.slice(0, 180)
          : 'Your account export could not be created.';
        const requestId = response.headers.get('x-request-id');
        const reference = requestId && /^[0-9a-f-]{36}$/i.test(requestId)
          ? ` Reference: ${requestId}.`
          : '';
        throw new Error(`${publicError}${reference}`);
      }
      const result = await presentAccountExport(accountExport);
      setMessage(result === 'downloaded'
        ? 'Your What Bin account export was downloaded as a JSON file.'
        : 'Choose where to save or send your What Bin account export.');
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }, [session]);

  const removeAccountData = useCallback(async () => {
    if (!session || (!supabase && !browserFixture)) {
      setError('Sign in before removing your What Bin account data.');
      return false;
    }
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`${apiBase}/account/delete`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${session.access_token}`,
          'x-bin-confirm-delete': 'remove-what-bin-account',
        },
      });
      const payload = await response.json()
        .catch(() => ({})) as AccountDataRemovalResponse;
      if (!response.ok) {
        const errorMessage = typeof payload.error === 'string'
          ? payload.error
          : 'Your What Bin account data could not be removed.';
        const guidance = typeof payload.guidance === 'string' ? payload.guidance : undefined;
        const requestId = typeof payload.requestId === 'string'
          && /^[0-9a-f-]{36}$/i.test(payload.requestId)
          ? payload.requestId
          : undefined;
        throw new AccountDataRemovalRequestError(
          [errorMessage, guidance, requestId ? `Reference: ${requestId}.` : undefined]
            .filter(Boolean)
            .join(' '),
        );
      }
      if (payload.removed !== true || payload.identityRetained !== true) {
        throw new AccountDataRemovalRequestError('Your What Bin account-data removal could not be confirmed.');
      }
      let signedOutLocally = false;
      if (supabase && !browserFixture) {
        try {
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
          signedOutLocally = !signOutError;
        } catch {
          // Product data has already been removed. Clear this app's in-memory
          // session even if its local auth cleanup call cannot complete.
        }
      } else {
        signedOutLocally = true;
      }
      setSession(null);
      setEntitlement(freeEntitlement);
      setMessage(signedOutLocally
        ? 'Your What Bin plan, support and eligible household data were removed, and this device was signed out. Saved addresses remain on this device. Your shared Supabase sign-in identity was retained.'
        : 'Your What Bin plan, support and eligible household data were removed. Local sign-out could not be confirmed, so sign out again when online. Your shared Supabase sign-in identity was retained.');
      return true;
    } catch (caught) {
      setError(caught instanceof AccountDataRemovalRequestError
        ? caught.message
        : 'Your What Bin account data could not be removed right now. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [browserFixture, session]);

  const value = useMemo<AccountContextValue>(() => ({
    configured: accountServiceConfigured || Boolean(browserFixture),
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
    preparePlusReEnrolment,
    exportAccountData,
    removeAccountData,
  }), [
    browserFixture,
    busy,
    entitlement,
    error,
    message,
    ready,
    refreshEntitlement,
    preparePlusReEnrolment,
    exportAccountData,
    removeAccountData,
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
