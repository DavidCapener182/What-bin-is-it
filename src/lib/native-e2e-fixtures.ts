import type { Collection, SavedAddress } from '@/lib/types';

export const nativeE2EFixtureMarker = 'maestro-proof-v1';
export const nativeE2ELoopbackApiBase = 'https://127.0.0.1:1/api';

export const nativeE2EFixtureAddress: SavedAddress = {
  id: 'native-e2e-home',
  label: 'E2E Home',
  line1: 'Internal native test fixture',
  postcode: 'M1 1AE',
  councilName: 'Internal E2E council fixture',
  providerId: 'native-e2e-council',
  councilAddressId: 'native-e2e-address',
  isPrimary: true,
};

function localDateKey(now: Date, offsetDays: number) {
  const date = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
    12,
  );
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function nativeE2EFixtureCollections(now = new Date()): Collection[] {
  const tomorrow = localDateKey(now, 1);
  const nextWeek = localDateKey(now, 8);
  return [
    {
      id: `native-e2e-general-${tomorrow}`,
      date: tomorrow,
      wasteType: 'general',
      source: 'council',
      label: 'E2E general bin',
      colour: '#253744',
    },
    {
      id: `native-e2e-recycling-${nextWeek}`,
      date: nextWeek,
      wasteType: 'recycling',
      source: 'council',
      label: 'E2E recycling bin',
      colour: '#1E6F5C',
    },
  ];
}

/**
 * Synthetic native fixtures require every guard to match. Supplying any real
 * account, store or API configuration disables them so this path cannot mask a
 * release build or exercise production services.
 */
export function nativeE2EFixturesEnabled() {
  const noRemoteCredentials = !process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
    && !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    && !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()
    && !process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY?.trim()
    && !process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY?.trim();

  return process.env.EXPO_PUBLIC_NATIVE_E2E_FIXTURES === nativeE2EFixtureMarker
    && process.env.EXPO_PUBLIC_LAUNCH_PHASE === 'proof'
    && process.env.EXPO_PUBLIC_ENABLE_NATIVE_PLUS_PURCHASES === 'false'
    && process.env.EXPO_PUBLIC_COUNCIL_API_BASE === nativeE2ELoopbackApiBase
    && noRemoteCredentials;
}
