import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses the resident app Apple system palette and typography", async () => {
  const [consoleStyles, residentTokens, layout] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../src/lib/design-system.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  for (const colour of ["#f2f2f7", "#ffffff", "#1c1c1e", "#636366", "#007aff", "#d1d1d6"]) {
    assert.match(consoleStyles.toLowerCase(), new RegExp(colour));
    assert.match(residentTokens.toLowerCase(), new RegExp(colour));
  }
  assert.match(consoleStyles, /-apple-system, BlinkMacSystemFont, "SF Pro Text"/);
  assert.doesNotMatch(layout, /IBM_Plex|next\/font/);
  assert.doesNotMatch(consoleStyles.toLowerCase(), /#061f2a|#0d8b7d|#f5f2eb|radial-gradient/);
});

test("narrow layouts retain complete back-office navigation and bounded form controls", async () => {
  const [consoleStyles, shell] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../components/console-shell-client.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(consoleStyles, /\.field\s*\{[^}]*min-width:\s*0/);
  assert.match(consoleStyles, /input,\s*textarea,\s*select\s*\{[^}]*min-width:\s*0/);
  assert.match(shell, /Complete mobile navigation/);
  assert.match(shell, /primaryNavigation[\s\S]*governanceNavigation/);
  assert.match(shell, /mobile-council-switcher/);
  assert.match(shell, /mobileMenuRef\.current\.open = false/);
});

test("the development launcher safely maps the resident workspace environment", async () => {
  const [packageJson, launcher] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/dev.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"dev":\s*"node scripts\/dev\.mjs"/);
  assert.match(launcher, /EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(launcher, /EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(launcher, /eyJ|postgres(?:ql)?:\/\//);
});

test("the council overview presents a neutral responsive operational queue", async () => {
  const [overview, styles] = await Promise.all([
    readFile(new URL("../components/council-overview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(overview, /Operational queue/);
  assert.match(overview, /operationalQueue\.map/);
  assert.match(styles, /\.operational-queue-list/);
  assert.match(styles, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*?\.operational-queue-list \{ grid-template-columns: 1fr; \}/);
  assert.doesNotMatch(styles.toLowerCase(), /purple|linear-gradient/);
});

test("partner setup uses a six-step guarded wizard and honest local drafts", async () => {
  const [wizard, page, styles] = await Promise.all([
    readFile(new URL("../components/partner-setup-wizard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(console)/partners/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const heading of [
    "Service details",
    "Areas and items",
    "Compliance evidence",
    "Price and payment",
    "Resident preview",
    "Approval and activation",
  ]) assert.match(wizard, new RegExp(heading));
  assert.match(wizard, /Save browser draft/);
  assert.match(wizard, /No council record has been created/);
  assert.match(wizard, /Official .* service[\s\S]*Charity or reuse service[\s\S]*resident-preview-sponsored/);
  assert.match(wizard, /name="status"[\s\S]*value="draft"/);
  assert.match(wizard, /name="status"[\s\S]*value="review"/);
  assert.match(page, /<PartnerSetupWizard/);
  assert.match(styles, /\.partner-wizard-progress/);
  assert.doesNotMatch(styles.toLowerCase(), /purple|linear-gradient/);
});
