import { BookOpenCheck } from "lucide-react";

import { saveGuidanceAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalQueue } from "@/components/operational-queue";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { listGuidancePage } from "@/lib/data";
import { formatDateTime, humanise } from "@/lib/format";
import { operationalQueueStateFromServerPage, type OperationalQueueSearchParams } from "@/lib/operational-queue";
import { councilRoleCan } from "@/lib/permissions";

type PageParams = OperationalQueueSearchParams & { error?: string; saved?: string };

const destinations = ["general", "recycling", "garden", "food", "other", "service", "check"] as const;
const statuses = ["published", "draft", "archived"] as const;

export default async function GuidancePage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canWrite = councilRoleCan(session.role, "guidance:write");
  const params = await searchParams;
  const serverPage = await listGuidancePage(session, params);
  const queue = operationalQueueStateFromServerPage(serverPage);

  const composer = canWrite ? (
    <OperationalDrawer
      description="Using the same item key updates the existing council answer without requiring an app release."
      title="Add or Update Guidance"
      triggerLabel="Add Guidance"
      triggerStyle="primary"
      wide
    >
      <section className="panel form-panel">
        <form action={saveGuidanceAction} className="stack-form">
          <div className="field-grid">
            <div className="field"><label htmlFor="itemKey">Item key</label><input autoComplete="off" id="itemKey" name="itemKey" placeholder="fluorescent-tubes…" required /></div>
            <div className="field"><label htmlFor="itemName">Item name</label><input autoComplete="off" id="itemName" maxLength={120} name="itemName" required /></div>
            <div className="field field-span"><label htmlFor="searchTerms">Search terms, one per line</label><textarea id="searchTerms" name="searchTerms" placeholder={"tube light…\nstrip light…"} /></div>
            <div className="field"><label htmlFor="destination">Destination</label><select id="destination" name="destination">{destinations.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="guidance-status">Status</label><select id="guidance-status" name="status">{statuses.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
            <div className="field field-span"><label htmlFor="heading">Short resident answer</label><input autoComplete="off" id="heading" maxLength={160} name="heading" required /></div>
            <div className="field field-span"><label htmlFor="guidance-detail">Preparation and exclusions</label><textarea id="guidance-detail" maxLength={400} name="detail" required /></div>
            <div className="field field-span"><label htmlFor="serviceUrl">Official service link</label><input autoComplete="off" id="serviceUrl" name="serviceUrl" type="url" /></div>
          </div>
          <button className="primary-button" type="submit">Save Council Guidance</button>
        </form>
      </section>
    </OperationalDrawer>
  ) : undefined;

  return (
    <>
      <PageHeader eyebrow="Local recycling rules" title="Recycling Guidance" description="Search and triage authority-approved answers, synonyms and resident destinations in a single council-scoped content queue." />
      <FeedbackBanner error={params.error} saved={params.saved} />
      <OperationalQueue
        action={composer}
        caption={`Local recycling guidance for ${session.organisation.name}, with item key, synonyms, destination and publication status.`}
        columns={[
          { label: "Item", sortKey: "name" },
          { label: "Destination" },
          { label: "Search Terms" },
          { label: "Status", sortKey: "status" },
          { label: "Updated", sortKey: "updated" },
          { label: "Actions" },
        ]}
        emptyState={<div className="empty-state"><BookOpenCheck aria-hidden="true" size={32} /><h2>No Matching Guidance</h2><p>The resident app continues to show its cautious UK guide until council-approved answers are published.</p></div>}
        filterLabel="destinations"
        filterOptions={destinations.map((value) => ({ label: humanise(value), value }))}
        pathname="/guidance"
        searchLabel="Search item, key, answer or synonym"
        state={queue}
        statusOptions={statuses.map((value) => ({ label: humanise(value), value }))}
        title="Guidance Library"
        viewKey="guidance"
      >
        {queue.items.map((item) => (
          <tr key={item.id}>
            <td className="queue-primary-cell" data-label="Item"><strong>{item.itemName}</strong><small>{item.itemKey} · {item.heading}</small></td>
            <td data-label="Destination">{humanise(item.destination)}</td>
            <td data-label="Search Terms">{item.searchTerms.length ? item.searchTerms.slice(0, 3).join(", ") : "No synonyms"}<small>{item.searchTerms.length > 3 ? `+${item.searchTerms.length - 3} more` : ""}</small></td>
            <td data-label="Status"><StatusPill status={item.status} /></td>
            <td data-label="Updated">{formatDateTime(item.updatedAt)}</td>
            <td className="queue-cell-actions" data-label="Actions">
              <OperationalDrawer title={item.itemName} triggerLabel="Review" triggerStyle="text">
                <div className="queue-record-detail">
                  <StatusPill status={item.status} />
                  <h3>{item.heading}</h3>
                  <p>{item.detail}</p>
                  <dl className="queue-detail-list">
                    <div><dt>Item key</dt><dd>{item.itemKey}</dd></div>
                    <div><dt>Destination</dt><dd>{humanise(item.destination)}</dd></div>
                    <div><dt>Synonyms</dt><dd>{item.searchTerms.length ? item.searchTerms.join(", ") : "None recorded"}</dd></div>
                    <div><dt>Updated</dt><dd>{formatDateTime(item.updatedAt)}</dd></div>
                    <div><dt>Official service</dt><dd>{item.serviceUrl ? <a href={item.serviceUrl} rel="noreferrer" target="_blank">Open Service</a> : "Not supplied"}</dd></div>
                  </dl>
                </div>
              </OperationalDrawer>
            </td>
          </tr>
        ))}
      </OperationalQueue>
      <div className="truth-note space-top-lg">Named content owner, effective/review dates, version history, bulk CSV workflows and four-eyes approval are not stored by the current guidance contract. This queue does not infer them from update timestamps.</div>
    </>
  );
}
