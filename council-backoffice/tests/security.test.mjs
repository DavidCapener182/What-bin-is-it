import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { councilRoleCan } from "../lib/permissions.ts";
import {
  assertUuid,
  normaliseItemKey,
  safeHttpsUrl,
  selectedValues,
} from "../lib/validation.ts";

test("support staff cannot publish or export council data", () => {
  assert.equal(councilRoleCan("support", "content:publish"), false);
  assert.equal(councilRoleCan("support", "analytics:export"), false);
  assert.equal(councilRoleCan("support", "reports:write"), true);
  assert.equal(councilRoleCan("support", "support:view"), true);
  assert.equal(councilRoleCan("support", "support:reply"), true);
  assert.equal(councilRoleCan("analyst", "support:view"), false);
});

test("only owners can change organisation identity", () => {
  assert.equal(councilRoleCan("owner", "organisation:manage"), true);
  assert.equal(councilRoleCan("admin", "organisation:manage"), false);
});

test("external URLs must use HTTPS", () => {
  assert.equal(safeHttpsUrl("https://example.gov.uk/report"), "https://example.gov.uk/report");
  assert.throws(() => safeHttpsUrl("http://example.gov.uk/report"), /HTTPS/);
  assert.throws(() => safeHttpsUrl("javascript:alert(1)"), /HTTPS/);
});

test("item keys are normalised and UUIDs are validated", () => {
  assert.equal(normaliseItemKey(" Fluorescent Tubes "), "fluorescent-tubes");
  assert.equal(
    assertUuid("123e4567-e89b-42d3-a456-426614174000"),
    "123e4567-e89b-42d3-a456-426614174000",
  );
  assert.throws(() => assertUuid("../../another-council"), /invalid/);
});

test("multi-value fields remove duplicates and empty input", () => {
  const form = new FormData();
  form.append("placements", "home");
  form.append("placements", "");
  form.append("placements", "home");
  form.append("placements", "schedule");
  assert.deepEqual(selectedValues(form, "placements"), ["home", "schedule"]);
});

test("published resident alerts enqueue only council-scoped consented broadcasts", async () => {
  const [actions, data, migration] = await Promise.all([
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../supabase/migrations/20260727205102_council_alert_push_delivery.sql", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(actions, /sendPush/);
  assert.match(actions, /requestCouncilBroadcast/);
  assert.match(data, /bin_council_broadcast_jobs/);
  assert.match(data, /session\.organisation\.id/);
  assert.match(migration, /create table if not exists public\.bin_council_push_registrations/);
  assert.match(migration, /create table if not exists public\.bin_council_broadcast_receipts/);
  assert.match(migration, /alter table public\.bin_council_push_registrations enable row level security/);
  assert.match(migration, /revoke all on table public\.bin_council_push_registrations from anon, authenticated/);
  assert.doesNotMatch(
    migration,
    /\b(postcode|street_address|uprn|resident_email)\b\s+(?:varchar|text)/i,
  );
});

test("platform administration is explicit and never inferred from email metadata", async () => {
  const [authSource, bootstrapSource] = await Promise.all([
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/bootstrap-platform-admin.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(authSource, /bin_council_platform_admins/);
  assert.match(authSource, /status = 'active'/);
  assert.doesNotMatch(authSource, /email.*endsWith|user_metadata|app_metadata/);
  assert.match(bootstrapSource, /--email/);
  assert.match(bootstrapSource, /--apply/);
});

test("council authentication uses a dedicated cookie namespace", async () => {
  const [serverSource, proxySource] = await Promise.all([
    readFile(new URL("../lib/supabase/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
  ]);
  for (const source of [serverSource, proxySource]) {
    assert.match(source, /name: "what-bin-council-auth"/);
    assert.match(source, /httpOnly: true/);
    assert.match(source, /sameSite: "lax"/);
  }
});
