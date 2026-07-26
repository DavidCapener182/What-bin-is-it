import { defineHandler } from 'nitro';

import { councilPartnerRegistryStatus } from '../../../api/_gateway/council-partner-adapter.ts';

export default defineHandler(() => {
  const councilPartners = councilPartnerRegistryStatus();
  return {
    ok: councilPartners.valid,
    service: 'what-bin-is-it-tonight',
    pwa: true,
    push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    councilPartners,
  };
});
