import { Activity, ShieldCheck } from "lucide-react";

import { createPlatformIncidentAction, updatePlatformIncidentAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalQueue } from "@/components/operational-queue";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requirePlatformAdminSession } from "@/lib/auth";
import { formatDateTime, humanise } from "@/lib/format";
import { operationalQueueStateFromServerPage, type OperationalQueueSearchParams } from "@/lib/operational-queue";
import { listPlatformIncidentsPage } from "@/lib/platform-status";

const components = ["resident-app", "council-gateway", "push", "accounts", "council-console", "partner-feeds"] as const;
const incidentStatuses = ["investigating", "identified", "monitoring", "resolved"] as const;
type PageParams = OperationalQueueSearchParams & { error?: string; saved?: string };

export default async function StatusAdminPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  await requirePlatformAdminSession();
  const params = await searchParams;
  const serverPage = await listPlatformIncidentsPage(params);
  const queue = operationalQueueStateFromServerPage(serverPage);
  const composer = (
    <OperationalDrawer description="Publish only evidence-backed public incident information. A blank council list means platform-wide impact." title="Record an Incident" triggerLabel="Record Incident" triggerStyle="primary" wide>
      <form action={createPlatformIncidentAction} className="stack-form">
        <div className="field-grid"><div className="field"><label htmlFor="component">Component</label><select id="component" name="component">{components.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div><div className="field"><label htmlFor="status">Status</label><select id="status" name="status"><option value="investigating">Investigating</option><option value="identified">Identified</option><option value="monitoring">Monitoring</option></select></div></div>
        <div className="field"><label htmlFor="title">Public title</label><input id="title" maxLength={160} name="title" required /></div>
        <div className="field"><label htmlFor="detail">Public detail</label><textarea id="detail" maxLength={1000} name="detail" required /></div>
        <div className="field"><label htmlFor="councilProviderIds">Affected council provider IDs</label><textarea id="councilProviderIds" name="councilProviderIds" placeholder="Leave blank for platform-wide" /></div>
        <div className="field"><label htmlFor="startsAt">Started</label><input id="startsAt" name="startsAt" required type="datetime-local" /></div>
        <button className="primary-button" type="submit">Publish Incident</button>
      </form>
    </OperationalDrawer>
  );
  return (
    <>
      <PageHeader eyebrow="Operations workspace" title="Service Status" description="Triage the recorded incident lifecycle for residents and procurement teams. No component is called operational merely because monitoring is absent." />
      <FeedbackBanner error={params.error} saved={params.saved} />
      <OperationalQueue
        action={composer}
        caption="Platform incidents that have been explicitly recorded, including affected component, council scope, start time and current public lifecycle state."
        columns={[
          { label: "Incident" },
          { label: "Component", sortKey: "component" },
          { label: "Scope" },
          { label: "Started", sortKey: "started" },
          { label: "Status", sortKey: "status" },
          { label: "Actions" },
        ]}
        emptyState={<div className="empty-state"><ShieldCheck aria-hidden="true" size={32} /><h2>No Matching Recorded Incidents</h2><p>This means no incident in the loaded record set matches the view. It is not a substitute for active monitoring.</p></div>}
        filterLabel="components"
        filterOptions={components.map((value) => ({ label: humanise(value), value }))}
        pathname="/status-admin"
        searchLabel="Search title, detail, component or council ID"
        state={queue}
        statusOptions={incidentStatuses.map((value) => ({ label: humanise(value), value }))}
        title="Incident Operations"
        viewKey="platform-incidents"
      >
        {queue.items.map((incident) => (
          <tr key={incident.id}>
            <td className="queue-primary-cell" data-label="Incident"><strong>{incident.title}</strong><small>Updated {formatDateTime(incident.updatedAt)}</small></td>
            <td data-label="Component">{humanise(incident.component)}</td>
            <td data-label="Scope">{incident.councilProviderIds.length ? `${incident.councilProviderIds.length} council${incident.councilProviderIds.length === 1 ? "" : "s"}` : "Platform-wide"}</td>
            <td data-label="Started"><time dateTime={incident.startsAt}>{formatDateTime(incident.startsAt)}</time></td>
            <td data-label="Status"><StatusPill status={incident.status} /></td>
            <td className="queue-cell-actions" data-label="Actions">
              <OperationalDrawer title={incident.title} triggerLabel="Review" triggerStyle="text">
                <div className="queue-record-detail">
                  <StatusPill status={incident.status} />
                  <p>{incident.detail}</p>
                  <dl className="queue-detail-list">
                    <div><dt>Component</dt><dd>{humanise(incident.component)}</dd></div>
                    <div><dt>Affected councils</dt><dd>{incident.councilProviderIds.length ? incident.councilProviderIds.join(", ") : "Platform-wide"}</dd></div>
                    <div><dt>Started</dt><dd>{formatDateTime(incident.startsAt)}</dd></div>
                    <div><dt>Last updated</dt><dd>{formatDateTime(incident.updatedAt)}</dd></div>
                    <div><dt>Resolved</dt><dd>{incident.resolvedAt ? formatDateTime(incident.resolvedAt) : "Not resolved"}</dd></div>
                  </dl>
                  {incident.status !== "resolved" ? <form action={updatePlatformIncidentAction} className="inline-form queue-record-actions"><input name="id" type="hidden" value={incident.id} /><button className="secondary-button button-small" name="status" value="monitoring">Move to Monitoring</button><button className="primary-button button-small" name="status" value="resolved">Resolve</button></form> : null}
                </div>
              </OperationalDrawer>
            </td>
          </tr>
        ))}
      </OperationalQueue>
      <div className="truth-note space-top-lg"><Activity aria-hidden="true" size={17} /> “No matching recorded incident” is not a verified uptime claim. Automated health monitors, subscriber updates and post-incident review records require separate backend contracts.</div>
    </>
  );
}
