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

function exportedAsyncFunctionSource(source, functionName) {
  const marker = `export async function ${functionName}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${functionName} must be exported`);
  const nextExport = source.indexOf("\nexport async function ", start + marker.length);
  return source.slice(start, nextExport === -1 ? source.length : nextExport);
}

function jsxFormSource(source, actionName) {
  const marker = `<form action={${actionName}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `form for ${actionName} must exist`);
  const end = source.indexOf("</form>", start);
  assert.notEqual(end, -1, `form for ${actionName} must be closed`);
  return source.slice(start, end + "</form>".length);
}

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

test("hosted authentication is time bounded and supports an authorised password sign-in", async () => {
  const [actions, auth, callback, database, fetchSource, loginButton, proxy] = await Promise.all([
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/database.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/fetch.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/login-submit-button.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
  ]);

  assert.match(actions, /export async function signInCouncilWithPassword/);
  assert.match(actions, /signInWithPassword/);
  assert.match(actions, /authorisedCouncilUserId/);
  assert.doesNotMatch(actions, /allowSignInAttempt\(email, "password"/);
  assert.doesNotMatch(actions, /console\.(?:log|info|warn|error)\([^\n]*password/i);
  assert.match(database, /statement_timeout/);
  assert.match(database, /lock_timeout/);
  assert.match(fetchSource, /AbortController/);
  assert.match(fetchSource, /COUNCIL_AUTH_FETCH_TIMEOUT_MS/);
  assert.match(loginButton, /useFormStatus/);
  assert.match(loginButton, /Signing in/);
  assert.match(proxy, /global:\s*\{\s*fetch: councilAuthFetch\s*\}/);
  assert.match(proxy, /catch/);
  assert.match(auth, /catch/);
  assert.match(callback, /catch/);
});

test("the council console exposes an installable privacy-safe PWA", async () => {
  const [manifest, layout, registration, worker, proxy, iconRoute] = await Promise.all([
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/pwa-registration.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pwa-icon/[size]/route.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(manifest, /What Bin Council Console/);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(manifest, /sizes:\s*"192x192"/);
  assert.match(manifest, /sizes:\s*"512x512"/);
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /<PwaRegistration/);
  assert.match(registration, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.doesNotMatch(worker, /caches\.(?:open|match)|addAll/);
  assert.match(proxy, /manifest\.webmanifest/);
  assert.match(proxy, /sw\.js/);
  assert.match(iconRoute, /ImageResponse/);
});

test("sponsored collection money movement is restricted to platform superadmins", async () => {
  const [actions, data, payments, partnerPage] = await Promise.all([
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/marketplace-payments.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/partners/page.tsx", import.meta.url), "utf8"),
  ]);

  for (const action of [
    "acceptMarketplaceBulkyBookingAction",
    "declineMarketplaceBulkyBookingAction",
    "completeMarketplaceBulkyBookingAction",
  ]) {
    assert.match(exportedAsyncFunctionSource(actions, action), /requirePlatformAdminAction\(\)/);
  }
  assert.match(data, /assertMarketplaceSuperadmin/);
  assert.match(data, /current\.booking_mode === "stripe-connect" && !session\.platformAdmin/);
  assert.match(data, /status = 'scheduled'/);
  assert.match(data, /stripe_transfer_id IS NULL/);
  assert.match(payments, /source_transaction: input\.chargeId/);
  assert.match(payments, /idempotencyKey: `bulky-payout-/);
  assert.match(payments, /idempotencyKey: `bulky-refund-/);
  assert.match(partnerPage, /canSettle = session\.platformAdmin && marketplacePaymentsConfigured\(\)/);
  assert.match(partnerPage, /canSettle && booking\.channel === "stripe-connect"/);
});

test("high-risk council mutations bind the submitted and authenticated council context", async () => {
  const [actions, announcementsPage, disruptionsPage, partnersPage] = await Promise.all([
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/announcements/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/disruptions/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/partners/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(actions, /function assertExpectedOrganisation/);
  assert.match(actions, /expectedOrganisationId !== session\.organisation\.id/);
  assert.match(actions, /function assertHighRiskConfirmation/);
  for (const action of [
    "saveAnnouncementAction",
    "changeAnnouncementStatusAction",
    "saveDisruptionAction",
    "changeDisruptionStatusAction",
    "changePartnerStatusAction",
    "confirmExternalBulkyBookingAction",
    "acceptMarketplaceBulkyBookingAction",
    "declineMarketplaceBulkyBookingAction",
    "completeMarketplaceBulkyBookingAction",
  ]) {
    const actionSource = exportedAsyncFunctionSource(actions, action);
    assert.match(actionSource, /assertExpectedOrganisation\(formData, session\)/);
    assert.match(actionSource, /assertHighRiskConfirmation\(formData\)/);
  }

  for (const [page, action] of [
    [announcementsPage, "saveAnnouncementAction"],
    [announcementsPage, "changeAnnouncementStatusAction"],
    [disruptionsPage, "saveDisruptionAction"],
    [disruptionsPage, "changeDisruptionStatusAction"],
    [partnersPage, "changePartnerStatusAction"],
    [partnersPage, "confirmExternalBulkyBookingAction"],
    [partnersPage, "acceptMarketplaceBulkyBookingAction"],
    [partnersPage, "declineMarketplaceBulkyBookingAction"],
    [partnersPage, "completeMarketplaceBulkyBookingAction"],
  ]) {
    const formSource = jsxFormSource(page, action);
    assert.match(
      formSource,
      /name="expectedOrganisationId"[^>]*value=\{session\.organisation\.id\}/,
    );
    assert.match(formSource, /name="confirmCouncilAction"/);
  }
});

test("council operational work is queried from real tenant-scoped records", async () => {
  const [data, overview] = await Promise.all([
    readFile(new URL("../lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/council-overview.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(data, /export async function councilOperationalQueue/);
  for (const table of [
    "bin_council_disruptions",
    "bin_council_announcements",
    "bin_council_broadcast_jobs",
    "bin_gateway_checks",
    "bin_resident_support_threads",
    "bin_bulky_bookings",
    "bin_analytics_events",
    "bin_council_partners",
  ]) {
    assert.match(data, new RegExp(table));
  }
  assert.match(data, /organisation_id = \$\{organisationId\}::uuid/);
  assert.match(data, /council_id = \$\{providerId\}/);
  assert.match(data, /council_provider_id = \$\{providerId\}/);
  assert.match(data, /event_name = 'missed_report_started'/);
  assert.match(data, /status IN \('published', 'scheduled'\)/);
  assert.match(data, /starts_at > now\(\)/);
  assert.match(data, /now\(\) AT TIME ZONE 'Europe\/London'/);
  assert.match(data, /approaching_count/);
  assert.match(data, /overdue_count/);
  assert.doesNotMatch(data, /operationalQueue[\s\S]*?Math\.random/);
  assert.match(overview, /Selected council · \{session\.organisation\.name\}/);
  assert.match(overview, /No evidenced items need action/);
});
