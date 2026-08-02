import { useCallback, useEffect, useState } from 'react';

import { apiBase } from '@/lib/api-base';
import type { WasteType } from '@/lib/types';
import { useAccount } from '@/lib/use-account';

export type HouseholdMember = { id: string; displayName: string; role: 'owner' | 'member'; joinedAt: string };
export type HouseholdAction = {
  id: string;
  actorUserId: string;
  responsibleUserId?: string;
  collectionDate: string;
  wasteType: WasteType;
  action: 'assigned' | 'put-out' | 'collected' | 'missed' | 'brought-in';
  occurredAt: string;
};
export type ResidentHousehold = {
  id: string;
  councilProviderId: string;
  displayName: string;
  role: 'owner' | 'member';
  createdAt: string;
  members: HouseholdMember[];
  actions: HouseholdAction[];
};

type HouseholdResponse = { households?: ResidentHousehold[]; error?: string };

export function useHouseholdSharing() {
  const { accessToken, ready: accountReady, user } = useAccount();
  const [households, setHouseholds] = useState<ResidentHousehold[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const request = useCallback(async (path: string, body?: object) => {
    if (!accessToken) throw new Error('Sign in to use household sharing.');
    const response = await fetch(`${apiBase}/households${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json() as HouseholdResponse & { invite?: { token: string; expiresAt: string } };
    if (!response.ok) throw new Error(payload.error ?? 'Household sharing is unavailable.');
    if (payload.households) setHouseholds(payload.households);
    return payload;
  }, [accessToken]);

  const refresh = useCallback(async () => {
    if (!accessToken) { setHouseholds([]); return; }
    setLoading(true); setError(undefined);
    try { await request(''); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Households could not be loaded.'); }
    finally { setLoading(false); }
  }, [accessToken, request]);

  useEffect(() => {
    if (!accountReady) return;
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [accountReady, refresh]);

  return {
    households,
    loading,
    error,
    signedIn: Boolean(user && accessToken),
    refresh,
    create: (input: { councilProviderId: string; displayName: string; memberName: string }) => request('', input),
    invite: async (householdId: string) => (await request('/invite', { householdId })).invite,
    join: (token: string, memberName: string) => request('/join', { token, memberName }),
    recordAction: (input: { householdId: string; collectionDate: string; wasteType: WasteType; action: HouseholdAction['action']; responsibleUserId?: string }) => request('/action', input),
  };
}
