import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { dataQualityDateOnly } from "../lib/data-quality-date.ts";
import {
  dataQualityReportStatus,
  decodeDataQualityReportCursor,
  encodeDataQualityReportCursor,
} from "../lib/data-quality-pagination.ts";

test("Postgres date rows are normalized before React renders them", () => {
  assert.equal(dataQualityDateOnly(new Date("2026-08-19T00:00:00.000Z")), "2026-08-19");
  assert.equal(dataQualityDateOnly("2026-08-20"), "2026-08-20");
  assert.equal(dataQualityDateOnly("20/08/2026"), null);
  assert.equal(dataQualityDateOnly(null), null);
});

test("data-quality queue is read-only and scoped to authenticated council context", async () => {
  const [data, page, navigation] = await Promise.all([
    readFile(new URL("../lib/data-quality.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/data-quality/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/console-shell-client.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /requireCouncilSession\("support:view"\)/);
  assert.match(page, /listDataQualityReports\(session, \{/);
  assert.match(page, /<form action="\/data-quality"[^>]*method="get"/);
  assert.doesNotMatch(page, /action=\{|updateDataQuality|deleteDataQuality/);
  assert.match(data, /session\.platformAdmin/);
  assert.match(data, /organisation_id = \$\{session\.organisation\.id\}::uuid/);
  assert.match(data, /council_provider_id = \$\{session\.organisation\.providerId\}/);
  assert.match(data, /expires_at > now\(\)/);
  assert.match(data, /ORDER BY created_at DESC, public_reference DESC/);
  assert.match(data, /\(created_at, public_reference\) < \(/);
  assert.match(data, /dataQualityPageSize \+ 1/);
  assert.doesNotMatch(data, /LIMIT 250/);
  assert.match(data, /dataQualityDateOnly\(row\.displayed_collection_date\)/);
  assert.doesNotMatch(data, /SELECT[^;]*client_id_hash/is);
  assert.match(navigation, /href: "\/data-quality"/);
  assert.match(navigation, /councilRoleCan\(session\.role, "support:view"\)/);
});

test("data-quality cursor and status filters are strict and page-stable", () => {
  assert.equal(dataQualityReportStatus("new"), "new");
  assert.equal(dataQualityReportStatus("resolved"), "resolved");
  assert.equal(dataQualityReportStatus("NEW"), undefined);
  assert.equal(dataQualityReportStatus(["new"]), undefined);

  const cursor = {
    createdAt: "2026-08-20T10:15:30.000Z",
    trackingReference: "DQ-20260820-012345ABCDEF",
  };
  const encoded = encodeDataQualityReportCursor(cursor);
  assert.deepEqual(decodeDataQualityReportCursor(encoded), cursor);
  assert.equal(decodeDataQualityReportCursor("not+a+cursor"), undefined);
  assert.equal(decodeDataQualityReportCursor(encodeDataQualityReportCursor({
    ...cursor,
    trackingReference: "DQ-invalid",
  })), undefined);
});
