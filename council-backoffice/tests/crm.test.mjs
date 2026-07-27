import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("CRM migrations isolate professional relationship data from resident access", async () => {
  const [baseMigration, correspondenceMigration] = await Promise.all([
    readFile(
      new URL("../../supabase/migrations/20260727095938_platform_crm.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../supabase/migrations/20260727101000_crm_correspondence.sql", import.meta.url),
      "utf8",
    ),
  ]);

  for (const table of [
    "bin_crm_accounts",
    "bin_crm_contacts",
    "bin_crm_activities",
    "bin_crm_tasks",
    "bin_crm_audit_logs",
  ]) {
    assert.match(baseMigration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(baseMigration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(baseMigration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
  }

  for (const table of [
    "bin_crm_threads",
    "bin_crm_messages",
    "bin_crm_mailbox_connections",
  ]) {
    assert.match(correspondenceMigration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(correspondenceMigration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(
      correspondenceMigration,
      new RegExp(`revoke all on table public\\.${table} from anon, authenticated`),
    );
  }

  assert.match(baseMigration, /lawful_basis/);
  assert.match(baseMigration, /do_not_contact/);
  assert.match(baseMigration, /retention_review_at/);
  assert.match(baseMigration, /bin_crm_audit_immutable/);
  assert.match(correspondenceMigration, /external_message_id/);
  assert.match(correspondenceMigration, /external_thread_id/);
  assert.match(correspondenceMigration, /credential_secret_ref/);
  assert.doesNotMatch(correspondenceMigration, /access_token|refresh_token|oauth_token/i);
});

test("all CRM pages and mutations require explicit platform-superadmin authorisation", async () => {
  const [overviewPage, messagesPage, accountPage, actions] = await Promise.all([
    readFile(new URL("../app/(console)/crm/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/crm/messages/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/crm/[accountId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
  ]);

  for (const page of [overviewPage, messagesPage, accountPage]) {
    assert.match(page, /requirePlatformAdminSession\(\)/);
  }
  assert.match(actions, /export async function saveCrmMessageAction/);
  assert.match(
    actions,
    /saveCrmMessageAction[\s\S]*?requirePlatformAdminAction\(\)[\s\S]*?createCrmMessage/,
  );
});

test("platform surfaces stay above council portals until a council is deliberately entered", async () => {
  const shell = await readFile(
    new URL("../components/console-shell-client.tsx", import.meta.url),
    "utf8",
  );

  assert.match(shell, /pathname === "\/" \|\| pathname\.startsWith\("\/crm"\)/);
  assert.match(shell, /const councilSurface = !platformSurface/);
  assert.match(shell, /\{councilSurface \? \(/);
  assert.match(shell, /Selected council portal/);
  assert.match(shell, /returnTo" type="hidden" value="\/council"/);
});

test("local superadmin convenience access is development-only and hosted login stays verified", async () => {
  const [auth, actions] = await Promise.all([
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /process\.env\.NODE_ENV === "production"/);
  assert.match(auth, /localhost/);
  assert.match(auth, /timingSafeEqual/);
  assert.match(auth, /COUNCIL_BACKOFFICE_DEV_SESSION_SECRET/);
  assert.match(actions, /startDevelopmentSuperadminSession/);
  assert.match(actions, /signInWithOtp/);
  assert.match(actions, /shouldCreateUser: false/);
});
