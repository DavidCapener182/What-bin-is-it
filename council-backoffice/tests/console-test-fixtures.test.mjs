import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  consoleE2eFixtureSessionFor,
  consoleE2eFixtureSessionToken,
  consoleTestFixtureRequestEnabled,
  consoleTestFixturesEnabled,
} from "../lib/console-test-fixtures.ts";

test("console browser fixtures require an explicit non-production gate", () => {
  assert.equal(consoleTestFixturesEnabled({ NODE_ENV: "development", COUNCIL_E2E_FIXTURES: "1" }), true);
  assert.equal(consoleTestFixturesEnabled({ NODE_ENV: "test", COUNCIL_E2E_FIXTURES: "1" }), true);
  assert.equal(consoleTestFixturesEnabled({ NODE_ENV: "production", COUNCIL_E2E_FIXTURES: "1" }), false);
  assert.equal(consoleTestFixturesEnabled({ NODE_ENV: "development" }), false);
});

test("actual-route fixture sessions additionally require a loopback request and die in production", () => {
  const development = { NODE_ENV: "development", COUNCIL_E2E_FIXTURES: "1" };
  const production = { NODE_ENV: "production", COUNCIL_E2E_FIXTURES: "1" };
  assert.equal(consoleTestFixtureRequestEnabled(development, "127.0.0.1:3011"), true);
  assert.equal(consoleTestFixtureRequestEnabled(development, "localhost:3011"), true);
  assert.equal(consoleTestFixtureRequestEnabled(development, "console.example.gov.uk"), false);
  assert.equal(consoleTestFixtureRequestEnabled(production, "127.0.0.1:3011"), false);
  assert.equal(consoleE2eFixtureSessionFor(consoleE2eFixtureSessionToken, development, "127.0.0.1:3011")?.role, "owner");
  assert.equal(consoleE2eFixtureSessionFor(consoleE2eFixtureSessionToken, production, "127.0.0.1:3011"), undefined);
  assert.equal(consoleE2eFixtureSessionFor(consoleE2eFixtureSessionToken, development, "console.example.gov.uk"), undefined);
});

test("the browser fixture is visibly test-only and has no data or action imports", async () => {
  const page = await readFile(new URL("../app/console-test-fixture/page.tsx", import.meta.url), "utf8");
  assert.match(page, /consoleE2eFixturesAvailable\(\)/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /TEST FIXTURE ONLY/);
  assert.doesNotMatch(page, /@\/lib\/(?:data|crm|resident-support|database)/);
  assert.doesNotMatch(page, /@\/app\/actions/);
});

test("actual console page and action seams are explicit fixture-session branches", async () => {
  const [actions, auth, announcements, disruptions, partners, support] = await Promise.all([
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/announcements/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/disruptions/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/partners/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/crm/messages/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(auth, /consoleE2eFixtureSession\(\)/);
  assert.match(actions, /isConsoleE2eFixtureSession\(session\)/);
  for (const page of [announcements, disruptions, partners, support]) {
    assert.match(page, /isConsoleE2eFixtureSession\(session\)/);
  }
});

test("Playwright starts the fixture only with the explicit development gate", async () => {
  const [config, journey] = await Promise.all([
    readFile(new URL("../playwright.config.ts", import.meta.url), "utf8"),
    readFile(new URL("./e2e/console-queues.spec.ts", import.meta.url), "utf8"),
  ]);
  assert.match(config, /COUNCIL_E2E_FIXTURES: "1"/);
  assert.match(config, /next dev/);
  assert.doesNotMatch(config, /next start|NODE_ENV:\s*"production"/);
  assert.match(journey, /AxeBuilder/);
  assert.match(journey, /Skip to Main Content/);
  assert.match(journey, /Save View/);
  assert.match(journey, /Open Test Drawer/);
});
