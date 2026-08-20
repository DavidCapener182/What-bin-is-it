import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parse } from 'yaml';

const workflowUrl = new URL('../.github/workflows/verify.yml', import.meta.url);
const packageUrl = new URL('../package.json', import.meta.url);
const branchProtectionUrl = new URL('../docs/security/BRANCH-PROTECTION.md', import.meta.url);

const REQUIRED_CHECKS = [
  'Verify application',
  'Release security and API contracts',
  'Native journey manifests',
  'Resident browser journeys',
  'Verify council console',
  'Council console browser journeys',
];

function namedStep(job, name) {
  return job.steps.find((step) => step.name === name);
}

test('release workflow exposes the documented required checks', async () => {
  const [workflowSource, branchProtection] = await Promise.all([
    readFile(workflowUrl, 'utf8'),
    readFile(branchProtectionUrl, 'utf8'),
  ]);
  const workflow = parse(workflowSource);
  const checkNames = Object.values(workflow.jobs).map((job) => job.name);

  assert.deepEqual(checkNames, REQUIRED_CHECKS);
  for (const checkName of REQUIRED_CHECKS) {
    assert.ok(branchProtection.includes(`\`${checkName}\``), `${checkName} must be documented`);
  }
});

test('browser gates use locked local tooling and always retain bounded evidence', async () => {
  const [workflowSource, packageSource] = await Promise.all([
    readFile(workflowUrl, 'utf8'),
    readFile(packageUrl, 'utf8'),
  ]);
  const workflow = parse(workflowSource);
  const packageJson = JSON.parse(packageSource);

  assert.equal(packageJson.devDependencies['@playwright/test'], '1.62.1');
  assert.equal(packageJson.devDependencies['@axe-core/playwright'], '4.13.0');
  assert.equal(packageJson.scripts['test:browser:resident'], 'playwright test -c tests/browser/playwright.config.mjs');
  assert.doesNotMatch(workflowSource, /--update-snapshots/);

  for (const jobName of ['resident-browser', 'council-console-browser']) {
    const job = workflow.jobs[jobName];
    assert.equal(job['runs-on'], 'macos-15');
    assert.equal(namedStep(job, jobName === 'resident-browser'
      ? 'Install pinned Chromium runtime'
      : 'Install locked Chromium runtime').run, 'npx --no-install playwright install chromium');

    const browserRun = namedStep(job, jobName === 'resident-browser'
      ? 'Run resident Playwright journeys'
      : 'Run actual-route and fixture console Playwright journeys').run;
    assert.doesNotMatch(browserRun, /--update-snapshots/);

    const upload = namedStep(job, jobName === 'resident-browser'
      ? 'Upload resident browser evidence'
      : 'Upload council console browser evidence');
    assert.equal(upload.if, '${{ always() }}');
    assert.equal(upload.uses, 'actions/upload-artifact@v6');
    assert.equal(upload.with['retention-days'], 14);
    assert.equal(upload.with['if-no-files-found'], 'ignore');
  }

  assert.match(
    namedStep(workflow.jobs['resident-browser'], 'Upload resident browser evidence').with.path,
    /artifacts\/playwright\/\*\*/,
  );
  const consoleEvidence = namedStep(
    workflow.jobs['council-console-browser'],
    'Upload council console browser evidence',
  ).with.path;
  assert.match(consoleEvidence, /council-backoffice\/test-results\/\*\*/);
  assert.match(consoleEvidence, /council-backoffice\/playwright-report\/\*\*/);
});

test('native and release-security jobs execute committed static gates', async () => {
  const workflow = parse(await readFile(workflowUrl, 'utf8'));
  const nativeRun = namedStep(
    workflow.jobs['native-journeys-static'],
    'Validate Maestro and EAS manifests',
  ).run;
  const securityRun = namedStep(
    workflow.jobs['release-security'],
    'Run focused release-security tests',
  ).run;

  assert.equal(nativeRun, 'npm run test:native:static');
  assert.match(securityRun, /tests\/api-route-error-boundaries\.test\.mjs/);
  assert.match(securityRun, /tests\/gateway-security-controls\.test\.mjs/);
  assert.match(securityRun, /tests\/provider-billing-safety\.test\.mjs/);
  assert.match(securityRun, /tests\/release-ci-gates\.test\.mjs/);
  assert.match(securityRun, /tests\/release-security-migration\.test\.mjs/);
});
