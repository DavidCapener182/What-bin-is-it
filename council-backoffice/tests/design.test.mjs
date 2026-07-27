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
