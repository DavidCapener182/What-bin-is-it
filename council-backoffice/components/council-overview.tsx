import {
  Activity,
  BellRing,
  CheckCircle2,
  RadioTower,
  ShieldCheck,
} from "lucide-react";

import { dashboardMetrics } from "@/lib/data";
import type { CouncilStaffSession } from "@/lib/types";
import { PageHeader } from "./page-header";

export async function CouncilOverview({ session }: { session: CouncilStaffSession }) {
  const overview = await dashboardMetrics(session);
  const pushConfigured = Boolean(
    process.env.COUNCIL_BROADCAST_SECRET?.trim()
    && process.env.RESIDENT_APP_BASE_URL?.trim(),
  );
  return (
    <>
      <PageHeader
        eyebrow="Live service picture"
        title={`Good morning, ${session.organisation.brandName ?? session.organisation.name}.`}
        description="A privacy-preserving operational view of active, currently linked and all-time consenting installations, verified gateway checks and published council content."
      />

      <section aria-label="Council service metrics" className="metric-grid">
        {overview.metrics.map((metric) => (
          <article className={`metric-card tone-${metric.tone ?? "teal"}`} key={metric.label}>
            <span className="metric-label">{metric.label}</span>
            <strong className="metric-value">{metric.value}</strong>
            <span className="metric-detail">{metric.detail}</span>
          </article>
        ))}
      </section>

      <section className="overview-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Resident channel readiness</h2>
            <RadioTower aria-hidden="true" color="#007AFF" size={22} />
          </div>
          <div className="connection-list">
            <div className="connection-row">
              <div><strong>Resident app surfaces</strong><br /><span>Home, schedule and guide publishing</span></div>
              <CheckCircle2 aria-label="Connected" color="#34C759" size={21} />
            </div>
            <div className="connection-row">
              <div><strong>Collection gateway</strong><br /><span>{overview.averageGatewayResponseMs ? `${overview.averageGatewayResponseMs} ms average response` : "Awaiting verified checks"}</span></div>
              {overview.gatewayAvailability === undefined
                ? <Activity aria-label="No data yet" color="#FF9500" size={21} />
                : <strong>{overview.gatewayAvailability}%</strong>}
            </div>
            <div className="connection-row">
              <div><strong>Remote push broadcasts</strong><br /><span>{pushConfigured ? "Processor connected; delivery remains limited to consented council registrations" : "Requires the private resident-app delivery connection"}</span></div>
              {pushConfigured
                ? <CheckCircle2 aria-label="Connected" color="#34C759" size={21} />
                : <BellRing aria-label="Not connected" color="#FF9500" size={21} />}
            </div>
            <div className="connection-row">
              <div><strong>Data boundary</strong><br /><span>No resident addresses, postcodes or report narratives are stored here</span></div>
              <ShieldCheck aria-label="Protected" color="#34C759" size={21} />
            </div>
          </div>
        </article>

        <aside className="panel">
          <div className="panel-heading"><h2>Gateway availability</h2></div>
          <div className="availability-ring">{overview.gatewayAvailability === undefined ? "—" : `${overview.gatewayAvailability}%`}</div>
          <p className="form-intro form-intro-spaced">
            Based on real collection-provider checks during the last {overview.dataPeriodDays} days.
          </p>
          <div className="truth-note">
            Collection volumes are shown only after a council round or property-count feed is approved. The console never manufactures an estimate.
          </div>
        </aside>
      </section>
    </>
  );
}
