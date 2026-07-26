import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const failures = [];
const externalSteps = [];

async function text(path) {
  return (await readFile(resolve(root, path), 'utf8')).trim();
}

async function json(path) {
  return JSON.parse(await text(path));
}

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

function external(condition, message) {
  if (!condition) externalSteps.push(message);
}

async function pngDimensions(path) {
  const file = await readFile(resolve(root, path));
  const signature = file.subarray(0, 8).toString('hex');
  requireCondition(signature === '89504e470d0a1a0a', `${path} must be a PNG.`);
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
    colourType: file[25],
  };
}

const app = (await json('app.json')).expo;
const eas = await json('eas.json');
const packageJson = await json('package.json');
const privacy = await text('src/app/privacy.tsx');
const terms = await text('src/app/terms.tsx');
const support = await text('src/app/support.tsx');
const dataSources = await text('src/app/data-sources.tsx');
const reviewNotes = await text('docs/store/APP-REVIEW-NOTES.md');

requireCondition(app.name === 'What Bin Is It Tonight?', 'The app name is not the approved product name.');
requireCondition(app.version === packageJson.version, 'package.json and app.json versions must match.');
requireCondition(app.ios?.bundleIdentifier === 'uk.whatbinistonight.app', 'The iOS bundle identifier is missing or changed.');
requireCondition(app.android?.package === 'uk.whatbinistonight.app', 'The Android application ID is missing or changed.');
requireCondition(/^\d+$/.test(app.ios?.buildNumber ?? ''), 'ios.buildNumber must be a positive numeric string.');
requireCondition(Number.isInteger(app.android?.versionCode) && app.android.versionCode > 0, 'android.versionCode must be a positive integer.');
requireCondition(app.ios?.config?.usesNonExemptEncryption === false, 'Set the reviewed iOS non-exempt encryption answer.');
requireCondition(app.ios?.privacyManifests?.NSPrivacyTracking === false, 'The iOS privacy manifest must explicitly disable tracking.');
requireCondition(app.ios?.supportsTablet === false, 'The first release is scoped to iPhone; enabling iPad also requires an iPad acceptance and screenshot set.');
requireCondition(eas.build?.production?.autoIncrement === true, 'The EAS production profile must auto-increment store build numbers.');
requireCondition(eas.submit?.production?.ios, 'The EAS iOS submit profile is missing.');
requireCondition(eas.submit?.production?.android?.track === 'internal', 'The first Android submission must target internal testing.');
requireCondition(
  eas.build?.production?.env?.EXPO_PUBLIC_LAUNCH_PHASE === 'proof',
  'The first production build must stay in the free proof phase.',
);

const icon = await pngDimensions('assets/images/app-icon.png');
requireCondition(icon.width === 1024 && icon.height === 1024, 'The store icon must be exactly 1024 × 1024.');
requireCondition(![4, 6].includes(icon.colourType), 'The App Store icon must not contain an alpha channel.');

for (const [path, source] of [
  ['src/app/privacy.tsx', privacy],
  ['src/app/terms.tsx', terms],
  ['src/app/support.tsx', support],
  ['src/app/data-sources.tsx', dataSources],
]) {
  requireCondition(source.length > 300, `${path} is missing substantive public content.`);
}

const appStoreName = await text('store/app-store/en-GB/name.txt');
const appStoreSubtitle = await text('store/app-store/en-GB/subtitle.txt');
const appStoreKeywords = await text('store/app-store/en-GB/keywords.txt');
const appStorePromo = await text('store/app-store/en-GB/promotional_text.txt');
const appStoreDescription = await text('store/app-store/en-GB/description.txt');
const playTitle = await text('store/google-play/en-GB/title.txt');
const playShort = await text('store/google-play/en-GB/short_description.txt');
const playDescription = await text('store/google-play/en-GB/full_description.txt');

requireCondition(appStoreName.length <= 30, 'App Store name exceeds 30 characters.');
requireCondition(appStoreSubtitle.length <= 30, 'App Store subtitle exceeds 30 characters.');
requireCondition(appStoreKeywords.length <= 100, 'App Store keywords exceed 100 characters.');
requireCondition(appStorePromo.length <= 170, 'App Store promotional text exceeds 170 characters.');
requireCondition(appStoreDescription.length <= 4000, 'App Store description exceeds 4,000 characters.');
requireCondition(playTitle.length <= 30, 'Google Play title exceeds 30 characters.');
requireCondition(playShort.length <= 80, 'Google Play short description exceeds 80 characters.');
requireCondition(playDescription.length <= 4000, 'Google Play full description exceeds 4,000 characters.');
requireCondition(
  !/all (uk )?councils|every council (is )?(live|supported)/i.test(`${appStoreDescription}\n${playDescription}`),
  'Store copy must not claim that every council has live collection dates.',
);
requireCondition(
  !/£1\.99|£14\.99|£29\.99|subscribe|subscription/i.test(`${appStoreDescription}\n${playDescription}`),
  'The proof-release store copy must not advertise Plus before in-app purchasing is live.',
);

external(Boolean(app.extra?.eas?.projectId), 'Link the repository to the intended Expo organization with `npx eas-cli init`.');
external(!/\[ADD [^\]]+\]/.test(reviewNotes), 'Replace App Review placeholders with a live, publication-safe address checked on submission day.');
external(Boolean(process.env.EXPO_TOKEN), 'Authenticate EAS locally or in CI before creating store builds.');
external(Boolean(process.env.APPLE_TEAM_ID), 'Create the Apple app record and record its Team/App Store IDs outside source control.');
external(Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON), 'Create the Play app and minimum-permission service account outside source control.');

if (failures.length) {
  console.error('\nStore repository checks failed:');
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exitCode = 1;
} else {
  console.log('✓ Store repository checks passed.');
}

if (externalSteps.length) {
  console.log('\nExternal account steps still required:');
  for (const step of externalSteps) console.log(`  • ${step}`);
}
