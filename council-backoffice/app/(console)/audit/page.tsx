import { ScrollText } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { requireCouncilSession } from "@/lib/auth";
import { listAuditEvents } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";

export default async function AuditPage() {
  const session = await requireCouncilSession("audit:view");
  const events = await listAuditEvents(session);
  return (
    <>
      <PageHeader eyebrow="Accountability" title="Audit trail" description="An immutable organisation-scoped record of council content, workflow, partner and branding changes. Message bodies and resident details are deliberately excluded." />
      {events.length ? <section className="audit-list" aria-label="Council audit events">{events.map((event) => <article className="audit-row" key={event.id}><time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time><div><div className="audit-action">{humanise(event.action.replaceAll(".", "-"))}</div><div className="data-meta"><span>{humanise(event.entityType)}</span>{Object.entries(event.summary).slice(0, 4).map(([key, value]) => <span key={key}>{humanise(key)}: {String(value)}</span>)}</div></div><span className="audit-actor">Actor {event.actorUserId.slice(0, 8)}…</span></article>)}</section> : <div className="empty-state"><ScrollText aria-hidden="true" size={32} /><h2>No audited changes yet</h2><p>Changes made through this council workspace will appear here.</p></div>}
    </>
  );
}
