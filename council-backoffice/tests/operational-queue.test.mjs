import assert from "node:assert/strict";
import test from "node:test";

import {
  operationalQueueHref,
  operationalQueueSavedQuery,
  operationalQueueState,
} from "../lib/operational-queue.ts";

const records = Array.from({ length: 32 }, (_, index) => ({
  id: index + 1,
  name: index === 20 ? "North recycling exception" : `Record ${index + 1}`,
  status: index % 2 ? "open" : "closed",
  type: index % 3 ? "service" : "urgent",
  updatedAt: `2026-08-${String((index % 28) + 1).padStart(2, "0")}`,
}));

function state(params = {}) {
  return operationalQueueState(records, params, {
    defaultSort: "updated",
    filterValues: ["service", "urgent"],
    getFilter: (record) => record.type,
    getSearchText: (record) => `${record.name} ${record.id}`,
    getStatus: (record) => record.status,
    sorts: {
      name: (record) => record.name,
      updated: (record) => record.updatedAt,
    },
    statusValues: ["open", "closed"],
  });
}

test("filters, sorts and paginates only the supplied real records", () => {
  const view = state({ direction: "desc", filter: "urgent", page: "2", perPage: "10", sort: "name", status: "closed" });
  assert.equal(view.unfilteredTotal, 32);
  assert.equal(view.total, 6);
  assert.equal(view.page, 1, "out-of-range pages clamp after filtering");
  assert.equal(view.pageCount, 1);
  assert.ok(view.items.every((record) => record.type === "urgent" && record.status === "closed"));
  assert.deepEqual(
    view.items.map((record) => record.name),
    [...view.items.map((record) => record.name)].sort((left, right) => right.localeCompare(left, "en-GB", { numeric: true })),
  );
});

test("search is bounded, case-insensitive and ignores unsupported filter input", () => {
  const view = state({ filter: "not-a-filter", q: `NORTH${"x".repeat(200)}`, status: "not-a-status" });
  assert.equal(view.query.length, 120);
  assert.equal(view.filter, "");
  assert.equal(view.status, "");

  const match = state({ q: "north recycling" });
  assert.equal(match.total, 1);
  assert.equal(match.items[0].id, 21);
});

test("queue links preserve the view while resetting pagination for sort changes", () => {
  const view = state({ direction: "desc", filter: "service", page: "2", perPage: "25", q: "record", sort: "name", status: "open" });
  assert.equal(
    operationalQueueHref("/work", view, { direction: "asc", page: 1, sort: "updated" }),
    "/work?q=record&status=open&filter=service&sort=updated&perPage=25",
  );
  assert.equal(
    operationalQueueSavedQuery(view),
    "q=record&status=open&filter=service&sort=name&direction=desc&perPage=25",
  );
  assert.equal(
    operationalQueueHref("/work", view, { page: 1 }, { view: "approvals" }),
    "/work?view=approvals&q=record&status=open&filter=service&sort=name&direction=desc&perPage=25",
  );
  assert.equal(
    operationalQueueSavedQuery(view, { view: "approvals" }),
    "view=approvals&q=record&status=open&filter=service&sort=name&direction=desc&perPage=25",
  );
});
