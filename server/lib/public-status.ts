import { councilPartnerRegistryStatus } from '../../api/_gateway/council-partner-adapter.ts';
import { councilDirectory } from '../../src/lib/council-directory.ts';

import { binDatabase, binDatabaseConfigured } from './bin-database';

export async function publicPlatformStatus() {
  const partnerRegistry = councilPartnerRegistryStatus();
  if (!binDatabaseConfigured()) {
    return {
      checkedAt: new Date().toISOString(),
      components: [
        { id: 'resident-app', label: 'Resident app', state: 'available', detail: 'This status endpoint is responding.' },
        { id: 'council-gateway', label: 'Council gateway', state: partnerRegistry.valid ? 'configured' : 'degraded', detail: partnerRegistry.valid ? 'Configured provider registry is valid.' : 'Provider registry configuration needs attention.' },
        { id: 'status-source', label: 'Incident history', state: 'not-monitored', detail: 'Incident storage is not configured in this environment.' },
      ],
      incidents: [],
      coverage: { mappedAuthorities: councilDirectory.length, liveAuthorities: null, note: 'Directory coverage is not the same as verified live schedules.' },
    };
  }
  const sql = binDatabase();
  const [incidents, gateway] = await Promise.all([
    sql<{
      id: string; component: string; status: string; title: string; detail: string;
      council_provider_ids: string[]; starts_at: Date; resolved_at: Date | null; updated_at: Date;
    }[]>`
      SELECT id, component, status, title, detail, council_provider_ids, starts_at, resolved_at, updated_at
      FROM bin_platform_incidents
      ORDER BY starts_at DESC
      LIMIT 100
    `,
    sql<{ last_check: Date | null; checks: number; successful: number }[]>`
      SELECT max(occurred_at) AS last_check, count(*)::int AS checks,
        count(*) FILTER (WHERE successful)::int AS successful
      FROM bin_gateway_checks
      WHERE occurred_at >= now() - interval '24 hours'
    `,
  ]);
  const active = incidents.filter((incident) => incident.status !== 'resolved');
  const gatewayRow = gateway[0] ?? { last_check: null, checks: 0, successful: 0 };
  const gatewayState = active.some((incident) => incident.component === 'council-gateway')
    ? 'incident'
    : gatewayRow.checks === 0
      ? 'not-monitored'
      : gatewayRow.successful === gatewayRow.checks
        ? 'available'
        : 'degraded';
  const component = (id: string, label: string, observedState?: string, detail?: string) => ({
    id,
    label,
    state: active.some((incident) => incident.component === id) ? 'incident' : observedState ?? 'no-recorded-incident',
    detail: detail ?? 'No active incident has been recorded. This is not an uptime guarantee.',
  });
  return {
    checkedAt: new Date().toISOString(),
    components: [
      component('resident-app', 'Resident app', 'available', 'This status endpoint is responding.'),
      component('council-gateway', 'Council gateway', gatewayState, gatewayRow.last_check ? `Last provider check ${gatewayRow.last_check.toISOString()}.` : 'No gateway check has been recorded in the last 24 hours.'),
      component('push', 'Notifications', undefined),
      component('accounts', 'Accounts', 'configured', 'Account storage is configured; no active incident has been recorded.'),
      component('council-console', 'Council console', undefined),
      component('partner-feeds', 'Partner feeds', partnerRegistry.valid ? 'configured' : 'degraded', partnerRegistry.valid ? 'Configured provider registry is valid.' : 'Provider registry configuration needs attention.'),
    ],
    incidents: incidents.map((incident) => ({
      id: incident.id,
      component: incident.component,
      status: incident.status,
      title: incident.title,
      detail: incident.detail,
      councilProviderIds: incident.council_provider_ids,
      startsAt: incident.starts_at.toISOString(),
      resolvedAt: incident.resolved_at?.toISOString(),
      updatedAt: incident.updated_at.toISOString(),
    })),
    coverage: {
      mappedAuthorities: councilDirectory.length,
      liveAuthorities: null,
      note: 'Mapped postcode authorities are not presented as verified live collection coverage.',
    },
  };
}
