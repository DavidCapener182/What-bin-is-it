import { ScrollText } from "lucide-react";

import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalQueue } from "@/components/operational-queue";
import { PageHeader } from "@/components/page-header";
import { requireCouncilSession } from "@/lib/auth";
import { listAuditEventsPage } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";
import { operationalQueueStateFromServerPage, type OperationalQueueSearchParams } from "@/lib/operational-queue";

function readableValue(value: unknown) {
  if (value === null || value === undefined) return "Not recorded";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const serialised = JSON.stringify(value);
    return serialised.length > 240 ? `${serialised.slice(0, 237)}…` : serialised;
  } catch {
    return "Structured value unavailable";
  }
}

type PageParams = OperationalQueueSearchParams;

export default async function AuditPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const session = await requireCouncilSession("audit:view");
  const params = await searchParams;
  const serverPage = await listAuditEventsPage(session, params);
  const entityTypes = serverPage.entityTypes;
  const queue = operationalQueueStateFromServerPage(serverPage);
  return (
    <>
      <PageHeader eyebrow="Accountability" title="Audit Trail" description="Search an immutable organisation-scoped record of council content, workflow, partner and branding changes. Message bodies and resident details are deliberately excluded." />
      <OperationalQueue
        caption={`Append-only audit events for ${session.organisation.name}, including action, entity, authorised staff identity and event time.`}
        columns={[
          { label: "Change", sortKey: "action" },
          { label: "Entity", sortKey: "entity" },
          { label: "Actor", sortKey: "actor" },
          { label: "Occurred", sortKey: "occurred" },
          { label: "Actions" },
        ]}
        emptyState={<div className="empty-state"><ScrollText aria-hidden="true" size={32} /><h2>No Matching Audit Events</h2><p>Changes made through this council workspace appear here when they match the selected view.</p></div>}
        filterLabel="entity types"
        filterOptions={entityTypes.map((value) => ({ label: humanise(value), value }))}
        pathname="/audit"
        searchLabel="Search action, entity, actor or summary"
        state={queue}
        title="Council Change History"
        viewKey="audit-events"
      >
        {queue.items.map((event) => (
          <tr key={event.id}>
            <td className="queue-primary-cell" data-label="Change"><strong>{humanise(event.action.replaceAll(".", "-"))}</strong><small>Event {event.id.slice(0, 8).toUpperCase()}</small></td>
            <td data-label="Entity">{humanise(event.entityType)}<small>{event.entityId ? `ID ${event.entityId}` : "No entity ID recorded"}</small></td>
            <td data-label="Actor">{event.actorLabel ?? `User ${event.actorUserId.slice(0, 8)}…`}</td>
            <td data-label="Occurred"><time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time></td>
            <td className="queue-cell-actions" data-label="Actions">
              <OperationalDrawer title={humanise(event.action.replaceAll(".", "-"))} triggerLabel="Inspect" triggerStyle="text">
                <div className="queue-record-detail">
                  <dl className="queue-detail-list">
                    <div><dt>Event ID</dt><dd>{event.id}</dd></div>
                    <div><dt>Action</dt><dd>{event.action}</dd></div>
                    <div><dt>Entity type</dt><dd>{event.entityType}</dd></div>
                    <div><dt>Entity ID</dt><dd>{event.entityId ?? "Not recorded"}</dd></div>
                    <div><dt>Actor</dt><dd>{event.actorLabel ?? event.actorUserId}</dd></div>
                    <div><dt>Occurred</dt><dd>{formatDateTime(event.occurredAt)}</dd></div>
                    {Object.entries(event.summary).map(([key, value]) => <div key={key}><dt>{humanise(key)}</dt><dd>{readableValue(value)}</dd></div>)}
                  </dl>
                </div>
              </OperationalDrawer>
            </td>
          </tr>
        ))}
      </OperationalQueue>
      <div className="truth-note space-top-lg">The current audit schema has no first-class request or correlation ID and no dedicated paginated export contract. A correlation value is shown only when the audited action explicitly stored one in its summary.</div>
    </>
  );
}
