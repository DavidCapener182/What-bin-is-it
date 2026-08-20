import { FlaskConical } from "lucide-react";
import { notFound } from "next/navigation";

import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalQueue } from "@/components/operational-queue";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { consoleE2eFixturesAvailable } from "@/lib/console-e2e-fixtures";
import { operationalQueueState, type OperationalQueueSearchParams } from "@/lib/operational-queue";

const fixtureRows = Array.from({ length: 24 }, (_, index) => ({
  id: `TEST-${String(index + 1).padStart(3, "0")}`,
  owner: index % 3 === 0 ? "Test Operations" : "Test Content",
  status: index % 4 === 0 ? "blocked" : index % 2 === 0 ? "in-progress" : "ready",
  title: index === 11 ? "TEST FIXTURE urgent bank holiday route" : `TEST FIXTURE queue record ${index + 1}`,
  updatedAt: `2026-08-${String((index % 20) + 1).padStart(2, "0")}T09:00:00.000Z`,
}));

export default async function ConsoleTestFixturePage({ searchParams }: { searchParams: Promise<OperationalQueueSearchParams> }) {
  if (!await consoleE2eFixturesAvailable()) notFound();
  const params = await searchParams;
  const queue = operationalQueueState(fixtureRows, params, {
    defaultDirection: "desc",
    defaultSort: "updated",
    filterValues: ["Test Operations", "Test Content"],
    getFilter: (row) => row.owner,
    getSearchText: (row) => `${row.id} ${row.title} ${row.owner} ${row.status}`,
    getStatus: (row) => row.status,
    sorts: { title: (row) => row.title, updated: (row) => row.updatedAt },
    statusValues: ["ready", "in-progress", "blocked"],
  });
  return (
    <>
      <a className="skip-link" href="#fixture-main">Skip to Main Content</a>
      <main className="console-test-fixture" id="fixture-main" tabIndex={-1}>
        <div className="truth-note space-bottom-lg"><FlaskConical aria-hidden="true" size={17} /> TEST FIXTURE ONLY · generated in memory · no council table reads or writes</div>
        <PageHeader eyebrow="Browser journey fixture" title="Operational Queue Test" description="Exercises the shared queue, saved URL view, semantic table, responsive labels and focused drawer without production records." />
        <OperationalQueue
          action={<OperationalDrawer description="This form does not submit or persist data." title="Create Test Fixture Record" triggerLabel="Open Test Drawer" triggerStyle="primary"><div className="stack-form"><div className="field"><label htmlFor="fixture-title">Test title</label><input id="fixture-title" name="fixtureTitle" /></div><button className="primary-button" type="button">Test-Only Action</button></div></OperationalDrawer>}
          caption="Generated test-only operational records used to verify keyboard, filtering, pagination and responsive behaviour."
          columns={[{ label: "Record", sortKey: "title" }, { label: "Owner" }, { label: "Updated", sortKey: "updated" }, { label: "Status" }, { label: "Actions" }]}
          emptyState={<div className="empty-state"><h2>No Matching Test Records</h2><p>Reset the test view to restore the generated fixture.</p></div>}
          filterLabel="owners"
          filterOptions={[{ label: "Test Operations", value: "Test Operations" }, { label: "Test Content", value: "Test Content" }]}
          pathname="/console-test-fixture"
          searchLabel="Search generated test records"
          state={queue}
          statusOptions={[{ label: "Ready", value: "ready" }, { label: "In progress", value: "in-progress" }, { label: "Blocked", value: "blocked" }]}
          title="Generated Test Queue"
          viewKey="console-test-fixture"
        >
          {queue.items.map((row) => <tr key={row.id}><td className="queue-primary-cell" data-label="Record"><strong>{row.title}</strong><small>{row.id}</small></td><td data-label="Owner">{row.owner}</td><td data-label="Updated"><time dateTime={row.updatedAt}>{new Date(row.updatedAt).toLocaleDateString("en-GB")}</time></td><td data-label="Status"><StatusPill status={row.status} /></td><td className="queue-cell-actions" data-label="Actions"><OperationalDrawer title={row.title} triggerLabel="Review" triggerStyle="text"><div className="queue-record-detail"><StatusPill status={row.status} /><p>{row.id} is generated test data and cannot be saved.</p></div></OperationalDrawer></td></tr>)}
        </OperationalQueue>
      </main>
    </>
  );
}
