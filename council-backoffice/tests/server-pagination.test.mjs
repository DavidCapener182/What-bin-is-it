import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function exportedFunction(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must remain exported`);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function assertCountedPage(source, name, { scopePattern } = {}) {
  const body = exportedFunction(source, name);
  assert.match(body, /count\(\*\)::int AS count/i, `${name} must count the filtered result set`);
  assert.match(body, /LIMIT \$\{(?:clampedRequest|page)\.pageSize\}/, `${name} must use the bounded page size`);
  assert.match(body, /OFFSET \$\{(?:clampedRequest|page)\.offset\}/, `${name} must expose records after the first page`);
  assert.match(body, /unfilteredTotal/, `${name} must report its complete scoped total`);
  if (scopePattern) assert.match(body, scopePattern, `${name} must repeat council scope in its queries`);
}

test("high-volume console queues use counted server filtering and pagination", async () => {
  const [data, crm, demand, status, support] = await Promise.all([
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/platform-demand.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/platform-status.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/resident-support.ts", import.meta.url), "utf8"),
  ]);

  for (const name of [
    "listAnnouncementsPage",
    "listDisruptionsPage",
    "listGuidancePage",
    "listPartnersPage",
    "listBulkyBookingsPage",
    "listSponsorshipProgrammesPage",
    "listAuditEventsPage",
  ]) assertCountedPage(data, name, {
    scopePattern: name === "listAuditEventsPage" ? undefined : /session\.organisation\.id/,
  });

  for (const name of [
    "listCrmAccountsPage",
    "listCrmContactsPage",
    "listCrmAccountMessagesPage",
    "listCrmActivitiesPage",
    "listCrmTasksPage",
  ]) assertCountedPage(crm, name);

  assertCountedPage(demand, "listPlatformCouncilDemandPage");
  assertCountedPage(status, "listPlatformIncidentsPage");
  assertCountedPage(support, "listResidentSupportThreadsPage", {
    scopePattern: /residentSupportCouncilScope\(session\)[\s\S]*?council_provider_id = \$\{councilScope\}/,
  });
});

test("visible console routes consume server pages without silent record caps", async () => {
  const routes = await Promise.all([
    ["announcements", "listAnnouncementsPage"],
    ["disruptions", "listDisruptionsPage"],
    ["guidance", "listGuidancePage"],
    ["partners", "listPartnersPage"],
    ["sponsorship", "listSponsorshipProgrammesPage"],
    ["audit", "listAuditEventsPage"],
    ["demand", "listPlatformCouncilDemandPage"],
    ["status-admin", "listPlatformIncidentsPage"],
    ["crm", "listCrmAccountsPage"],
  ].map(async ([route, reader]) => ({
    reader,
    source: await readFile(new URL(`../app/(console)/${route}/page.tsx`, import.meta.url), "utf8"),
  })));

  for (const { reader, source } of routes) {
    assert.match(source, new RegExp(`${reader}\\(`));
    assert.match(source, /operationalQueueStateFromServerPage\(/);
    assert.doesNotMatch(source, /sourceLimit=/);
  }

  const account = await readFile(new URL("../app/(console)/crm/[accountId]/page.tsx", import.meta.url), "utf8");
  for (const reader of ["listCrmContactsPage", "listCrmAccountMessagesPage", "listCrmActivitiesPage", "listCrmTasksPage"]) {
    assert.match(account, new RegExp(`${reader}\\(`));
  }
  assert.doesNotMatch(account, /messages\.slice\(/);
  assert.doesNotMatch(account, /getCrmAccountBundle|listCrmMessages\(/);
  assert.match(account, /complete server-side paging/);
});
