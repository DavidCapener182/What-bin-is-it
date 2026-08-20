import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { parseAllDocuments, parseDocument } from 'yaml';

const root = resolve(import.meta.dirname, '..');
const expectedAppId = 'uk.whatbinistonight.app';
const expectedFixtureMarker = 'maestro-proof-v1';
const expectedLoopbackApiBase = 'https://127.0.0.1:1/api';
const expectedFlowFiles = [
  'android/07-offline-cold-start.yaml',
  'android/08-predictive-back.yaml',
  'common/01-onboarding-manual-postcode.yaml',
  'common/02-primary-tabs-and-back.yaml',
  'common/03-push-deep-link-and-magic-return.yaml',
  'common/04-notification-permission-and-reminders.yaml',
  'common/05-widget-and-purchase-gates.yaml',
  'common/06-bulky-checkout-return.yaml',
  'ios/09-live-activity-boundary.yaml',
];
const requiredCoverageTags = [
  'onboarding',
  'manual-postcode',
  'navigation',
  'push-deep-link',
  'magic-link-return',
  'notification-permission',
  'reminder-scheduling',
  'widget-refresh',
  'purchase-gate',
  'restore-gate',
  'bulky-checkout-return',
  'offline-cold-start',
  'predictive-back',
  'live-activity',
];
const allowedCommands = new Set([
  'assertNotVisible',
  'assertVisible',
  'back',
  'extendedWaitUntil',
  'hideKeyboard',
  'inputText',
  'killApp',
  'launchApp',
  'openLink',
  'scrollUntilVisible',
  'setAirplaneMode',
  'setPermissions',
  'tapOn',
  'waitForAnimationToEnd',
]);
const allowedDeepLinkPaths = new Set([
  '/account',
  '/activity',
  '/bulky-booking',
  '/onboarding',
  '/plus',
  '/reminder-settings',
  '/settings',
]);
const blockedCredentialEnvironmentNames = [
  'EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parsedDocument(document, label) {
  if (document.errors.length) {
    throw new Error(`${label}: ${document.errors.map((error) => error.message).join('; ')}`);
  }
  return document.toJS();
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}

async function yamlFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return yamlFiles(join(directory, entry.name), relativePath);
    return /\.ya?ml$/i.test(entry.name) ? [relativePath] : [];
  }));
  return files.flat().sort();
}

function commandName(command) {
  if (typeof command === 'string') return command;
  if (!command || typeof command !== 'object' || Array.isArray(command)) return undefined;
  const keys = Object.keys(command);
  return keys.length === 1 ? keys[0] : undefined;
}

function validateDeepLink(link, label) {
  invariant(typeof link === 'string', `${label}: openLink requires a string link.`);
  let parsed;
  try {
    parsed = new URL(link);
  } catch {
    throw new Error(`${label}: openLink is not a valid URL.`);
  }
  invariant(parsed.protocol === 'whatbinistonight:', `${label}: only the app scheme is allowed.`);
  invariant(!parsed.hostname && !parsed.username && !parsed.password, `${label}: deep links cannot target a host or contain credentials.`);
  invariant(!parsed.hash, `${label}: deep links cannot contain fragments.`);
  invariant(allowedDeepLinkPaths.has(parsed.pathname), `${label}: deep-link path ${parsed.pathname} is not allowlisted.`);

  const entries = [...parsed.searchParams.entries()];
  if (parsed.pathname === '/account') {
    invariant(entries.length === 2, `${label}: account return must contain only the safe cancellation fields.`);
    invariant(parsed.searchParams.get('error') === 'access_denied', `${label}: account return must be cancelled.`);
    invariant(parsed.searchParams.get('error_description') === 'native-e2e-cancelled', `${label}: account return description must be synthetic.`);
    return;
  }
  if (parsed.pathname === '/bulky-booking') {
    invariant(entries.length === 2, `${label}: bulky return must contain only booking and reference.`);
    invariant(parsed.searchParams.get('booking') === 'cancelled', `${label}: bulky checkout must use the non-mutating cancellation return.`);
    invariant(/^WB-E2E[0-9A-F]{9}$/.test(parsed.searchParams.get('reference') ?? ''), `${label}: bulky reference must be synthetic and structurally valid.`);
    return;
  }
  invariant(entries.length === 0, `${label}: this local route does not accept query data in proof journeys.`);
}

function validateCommand(command, file, index) {
  const label = `${file}:${index + 1}`;
  const name = commandName(command);
  invariant(name && allowedCommands.has(name), `${label}: unsupported command ${name ?? 'shape'}.`);
  if (typeof command === 'string') return name;

  if (name === 'openLink') {
    const link = typeof command.openLink === 'string' ? command.openLink : command.openLink?.link;
    validateDeepLink(link, label);
  }
  if (name === 'setAirplaneMode') {
    invariant(command.setAirplaneMode === 'enabled' || command.setAirplaneMode === 'disabled', `${label}: airplane mode must be explicitly enabled or disabled.`);
    if (command.setAirplaneMode === 'enabled') {
      invariant(file === 'android/07-offline-cold-start.yaml', `${label}: only the Android offline journey may enable airplane mode.`);
    }
  }
  if (name === 'setPermissions') {
    const permissions = command.setPermissions?.permissions;
    invariant(command.setPermissions && !command.setPermissions.appId, `${label}: permissions may only target the app under test.`);
    invariant(
      permissions
      && Object.keys(permissions).length === 1
      && ['allow', 'deny'].includes(permissions.notifications),
      `${label}: only notification permission may change after launch.`,
    );
  }
  if (name === 'inputText') {
    invariant(command.inputText === 'NOTAPOSTCODE', `${label}: only the synthetic invalid postcode may be entered.`);
  }
  return name;
}

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

export async function validateNativeJourneys() {
  const flowDirectory = resolve(root, '.maestro');
  const flowFiles = await yamlFiles(flowDirectory);
  invariant(
    JSON.stringify(flowFiles) === JSON.stringify(expectedFlowFiles),
    `Native proof flow inventory changed: ${flowFiles.join(', ')}.`,
  );

  const tagOwners = new Map(requiredCoverageTags.map((tag) => [tag, []]));
  for (const file of flowFiles) {
    const source = await readFile(resolve(flowDirectory, file), 'utf8');
    invariant(source.length <= 16 * 1024, `${file}: flow exceeds 16 KiB.`);
    invariant(
      !/access[_-]?token|refresh[_-]?token|token[_-]?hash|bearer\s+|password\s*:|secret\s*:|api[_-]?key\s*:/i.test(source),
      `${file}: flow must not contain credentials.`,
    );
    const documents = parseAllDocuments(source);
    invariant(documents.length === 2, `${file}: Maestro flow must contain header and command documents.`);
    const header = parsedDocument(documents[0], file);
    const commands = parsedDocument(documents[1], file);
    invariant(header?.appId === expectedAppId, `${file}: appId must match the native bundle identifiers.`);
    invariant(Array.isArray(header.tags) && header.tags.includes('proof-safe'), `${file}: proof-safe tag is required.`);
    invariant(Array.isArray(commands) && commands.length > 1, `${file}: commands are required.`);
    invariant(commands[0]?.setAirplaneMode === 'disabled', `${file}: every flow must restore connectivity before launch.`);
    invariant(commands[1]?.launchApp?.clearState === true, `${file}: the first launch must clear app state.`);
    invariant(commands[1]?.launchApp?.clearKeychain === true, `${file}: the first launch must clear the keychain.`);
    invariant(commands[1]?.launchApp?.permissions?.all === 'deny', `${file}: the first launch must deny all permissions.`);
    invariant(
      commands.slice(2).every((command) => command?.launchApp?.clearState !== true),
      `${file}: state may only be cleared on the initial launch.`,
    );

    if (file.startsWith('android/')) {
      invariant(header.tags.includes('android-only') && !header.tags.includes('ios-only'), `${file}: Android platform tag is required.`);
    } else if (file.startsWith('ios/')) {
      invariant(header.tags.includes('ios-only') && !header.tags.includes('android-only'), `${file}: iOS platform tag is required.`);
    } else {
      invariant(!header.tags.includes('android-only') && !header.tags.includes('ios-only'), `${file}: common flows cannot be platform-only.`);
    }

    header.tags.forEach((tag) => tagOwners.get(tag)?.push(file));
    const commandNames = commands.map((command, index) => validateCommand(command, file, index));
    if (commands.some((command) => command?.setAirplaneMode === 'enabled')) {
      invariant(commands.at(-1)?.setAirplaneMode === 'disabled', `${file}: a flow that enables airplane mode must restore it.`);
    }
    if (commandNames.includes('killApp')) {
      invariant(file === 'android/07-offline-cold-start.yaml', `${file}: only the offline journey may kill the app.`);
    }
  }
  for (const [tag, owners] of tagOwners) {
    invariant(owners.length === 1, `Coverage tag ${tag} must be owned by exactly one flow; found ${owners.join(', ') || 'none'}.`);
  }

  const eas = await readJson('eas.json');
  const profile = eas.build?.['e2e-test'];
  invariant(profile?.distribution === 'internal', 'e2e-test must be an internal build.');
  invariant(profile?.environment === 'preview', 'e2e-test must use the isolated preview environment.');
  invariant(profile?.android?.buildType === 'apk', 'e2e-test Android build must be an APK.');
  invariant(profile?.ios?.simulator === true, 'e2e-test iOS build must target the simulator.');
  invariant(profile?.env?.EXPO_PUBLIC_LAUNCH_PHASE === 'proof', 'e2e-test must use proof launch phase.');
  invariant(profile?.env?.EXPO_PUBLIC_ENABLE_NATIVE_PLUS_PURCHASES === 'false', 'Native purchases must remain disabled in e2e-test.');
  invariant(profile?.env?.EXPO_PUBLIC_NATIVE_E2E_FIXTURES === expectedFixtureMarker, 'e2e-test must opt into the exact synthetic fixture marker.');
  invariant(profile?.env?.EXPO_PUBLIC_COUNCIL_API_BASE === expectedLoopbackApiBase, 'e2e-test API traffic must fail closed on loopback port 1.');
  for (const name of blockedCredentialEnvironmentNames) {
    invariant(profile?.env?.[name] === '', `e2e-test must explicitly blank ${name}.`);
  }
  for (const [name, candidate] of Object.entries(eas.build ?? {})) {
    if (name === 'e2e-test') continue;
    invariant(candidate?.env?.EXPO_PUBLIC_NATIVE_E2E_FIXTURES === undefined, `${name}: native E2E fixtures must not be enabled outside e2e-test.`);
  }

  const packageJson = await readJson('package.json');
  invariant(packageJson.dependencies?.['expo-network'] === '~57.0.1', 'Expo SDK 57 network state must be locked to ~57.0.1.');

  const app = await readJson('app.json');
  invariant(app.expo?.android?.package === expectedAppId, 'Android package does not match the Maestro appId.');
  invariant(app.expo?.android?.predictiveBackGestureEnabled === true, 'Android predictive back must remain enabled.');
  invariant(app.expo?.android?.blockedPermissions?.includes('android.permission.SCHEDULE_EXACT_ALARM'), 'Exact-alarm permission must remain blocked.');
  invariant(app.expo?.ios?.bundleIdentifier === expectedAppId, 'iOS bundle ID does not match the Maestro appId.');
  invariant(app.expo?.scheme === 'whatbinistonight', 'Deep-link scheme does not match the proof journeys.');
  const pluginNames = (app.expo?.plugins ?? []).map(pluginName);
  invariant(pluginNames.includes('expo-notifications'), 'Native notification configuration is required.');
  invariant(pluginNames.includes('expo-widgets'), 'The iOS widget and Live Activity extension is required.');
  invariant(pluginNames.includes('react-native-android-widget'), 'The Android widget extension is required.');

  const [appDataSource, fixtureSource, notificationNavigationSource, notificationRoutes, onlineStatusSource, productStateSource] = await Promise.all([
    readFile(resolve(root, 'src/lib/use-app-data.tsx'), 'utf8'),
    readFile(resolve(root, 'src/lib/native-e2e-fixtures.ts'), 'utf8'),
    readFile(resolve(root, 'src/components/notification-navigation.native.tsx'), 'utf8'),
    readJson('shared/notification-routes.json'),
    readFile(resolve(root, 'src/lib/use-online-status.ts'), 'utf8'),
    readFile(resolve(root, 'src/lib/use-product-state.tsx'), 'utf8'),
  ]);
  invariant(appDataSource.includes('if (nativeE2EFixturesEnabled()) return buildInitialState();'), 'Persisted state must not override native E2E fixtures.');
  invariant(appDataSource.includes('syncHomeScreenWidget({ address: activeAddress, collections })'), 'Fixture state must reach the native widget sync boundary.');
  invariant(fixtureSource.includes('noRemoteCredentials'), 'Native fixtures must fail closed when remote credentials are present.');
  invariant(onlineStatusSource.includes('useNetworkState()'), 'Native online status must observe Expo Network.');
  invariant(Array.isArray(notificationRoutes) && notificationRoutes.includes('/activity'), 'The tested push destination must remain allowlisted.');
  invariant(notificationNavigationSource.includes('approvedNativeNotificationPath(url)'), 'Notification actions must use the route allowlist.');
  invariant(productStateSource.includes('buildCollectionLiveSurfaceSnapshot(') && productStateSource.includes('syncCollectionLiveSurface(snapshot)'), 'Fixture state must reach the Live Activity boundary.');

  const workflowSource = await readFile(resolve(root, '.eas/workflows/native-proof-journeys.yml'), 'utf8');
  invariant(workflowSource.length <= 16 * 1024, 'EAS native workflow exceeds 16 KiB.');
  const workflowDocument = parseDocument(workflowSource);
  const workflow = parsedDocument(workflowDocument, 'native-proof-journeys.yml');
  invariant(
    Object.keys(workflow?.on ?? {}).length === 1 && workflow.on.workflow_dispatch,
    'Native device workflow must remain manual-dispatch only.',
  );
  const jobs = workflow?.jobs;
  invariant(
    JSON.stringify(Object.keys(jobs ?? {}).sort()) === JSON.stringify([
      'build_android_e2e',
      'build_ios_e2e',
      'maestro_android',
      'maestro_ios',
    ]),
    'Native workflow job inventory changed.',
  );
  invariant(jobs?.build_android_e2e?.params?.profile === 'e2e-test', 'Android workflow build must use e2e-test.');
  invariant(jobs?.build_ios_e2e?.params?.profile === 'e2e-test', 'iOS workflow build must use e2e-test.');
  const expectedWorkflowPaths = {
    maestro_android: ['./.maestro/common', './.maestro/android'],
    maestro_ios: ['./.maestro/common', './.maestro/ios'],
  };
  for (const id of ['maestro_android', 'maestro_ios']) {
    const job = jobs?.[id];
    invariant(job?.type === 'maestro', `${id}: must use the EAS Maestro job.`);
    invariant(job?.environment === 'preview', `${id}: must use the preview environment.`);
    invariant(JSON.stringify(job?.params?.flow_path) === JSON.stringify(expectedWorkflowPaths[id]), `${id}: must run common plus platform-specific flows.`);
    invariant(job?.params?.include_tags === 'proof-safe', `${id}: must select proof-safe flows.`);
    invariant(job?.params?.maestro_version === '2.7.0', `${id}: Maestro must be pinned.`);
    invariant(job?.params?.record_screen === true, `${id}: screen recording is required for evidence.`);
  }

  return { flowFiles, coverageTags: requiredCoverageTags };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = await validateNativeJourneys();
  console.log(`Validated ${result.flowFiles.length} Maestro flows, ${result.coverageTags.length} coverage tags and the EAS native workflow.`);
}
