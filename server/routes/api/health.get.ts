import { defineHandler } from 'nitro';

import { councilPartnerRegistryStatus } from '../../../api/_gateway/council-partner-adapter.ts';
import { apiJson, apiRequestId } from '../../lib/api-http';
import { serverGatewaySecurityControls } from '../../lib/gateway-security-controls';

export default defineHandler((event) => {
  const requestId = apiRequestId(event.req);
  const councilPartners = councilPartnerRegistryStatus();
  const gatewayReady = serverGatewaySecurityControls.ready();
  return apiJson(requestId, {
    ok: councilPartners.valid && gatewayReady,
    service: 'what-bin-is-it-tonight',
    pwa: true,
    push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    councilPartners,
    publicGateway: {
      enabled: serverGatewaySecurityControls.enabled(),
      durableAbuseControlsReady: gatewayReady,
    },
  }, { status: councilPartners.valid && gatewayReady ? 200 : 503 });
});
