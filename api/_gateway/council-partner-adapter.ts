import type {
  CollectionOutput,
  CouncilAdapter,
  CouncilAddress,
  CouncilService,
} from './adapter-registry.ts';
import {
  isUpstreamResponseError,
  readBoundedUpstreamJson,
  upstreamResponseErrorCodes,
} from './upstream-response.ts';
import { gatewayProviderBudgets } from './release-budget.ts';

export type CouncilPartnerCapability = 'addresses' | 'collections' | 'services';

export type CouncilPartnerConfig = {
  providerId: string;
  councilName: string;
  baseUrl: string;
  capabilities: readonly CouncilPartnerCapability[];
  credentialEnv?: string;
  authHeader?: string;
  authScheme?: string;
};

type Environment = Record<string, string | undefined>;
type Fetcher = typeof fetch;

const providerIdPattern = /^lad-[ensw]\d{8}$/;
const environmentNamePattern = /^[A-Z][A-Z0-9_]{2,100}$/;
const headerNamePattern = /^[A-Za-z0-9-]{1,80}$/;
const allowedCapabilities = new Set<CouncilPartnerCapability>(['addresses', 'collections', 'services']);
const maximumPartnerResponseBytes = 1024 * 1024;

function safeBaseUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 500) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return undefined;
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

function parseConfig(value: unknown): CouncilPartnerConfig | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const baseUrl = safeBaseUrl(item.baseUrl);
  if (
    typeof item.providerId !== 'string'
    || !providerIdPattern.test(item.providerId)
    || typeof item.councilName !== 'string'
    || !item.councilName.trim()
    || item.councilName.length > 160
    || !baseUrl
    || !Array.isArray(item.capabilities)
    || !item.capabilities.includes('collections')
    || item.capabilities.some((capability) => !allowedCapabilities.has(capability as CouncilPartnerCapability))
    || (item.credentialEnv !== undefined && (
      typeof item.credentialEnv !== 'string'
      || !environmentNamePattern.test(item.credentialEnv)
    ))
    || (item.authHeader !== undefined && (
      typeof item.authHeader !== 'string'
      || !headerNamePattern.test(item.authHeader)
    ))
    || (item.authScheme !== undefined && (
      typeof item.authScheme !== 'string'
      || item.authScheme.length > 40
      || /[\r\n]/.test(item.authScheme)
    ))
  ) return undefined;

  return {
    providerId: item.providerId,
    councilName: item.councilName.trim(),
    baseUrl,
    capabilities: [...new Set(item.capabilities)] as CouncilPartnerCapability[],
    credentialEnv: item.credentialEnv as string | undefined,
    authHeader: item.authHeader as string | undefined,
    authScheme: item.authScheme as string | undefined,
  };
}

export function parseCouncilPartnerRegistry(value: string | undefined): CouncilPartnerConfig[] {
  if (!value?.trim()) return [];
  let payload: unknown;
  try {
    payload = JSON.parse(value);
  } catch {
    throw new Error('COUNCIL_PARTNER_REGISTRY_JSON is not valid JSON.');
  }
  if (!Array.isArray(payload) || payload.length > 361) {
    throw new Error('COUNCIL_PARTNER_REGISTRY_JSON must be an array of council connector definitions.');
  }
  const configs = payload.map(parseConfig);
  if (configs.some((config) => !config)) {
    throw new Error('COUNCIL_PARTNER_REGISTRY_JSON contains an invalid council connector.');
  }
  const typed = configs as CouncilPartnerConfig[];
  if (new Set(typed.map((config) => config.providerId)).size !== typed.length) {
    throw new Error('COUNCIL_PARTNER_REGISTRY_JSON contains a duplicate council provider.');
  }
  return typed;
}

function partnerUrl(config: CouncilPartnerConfig, path: string) {
  return new URL(path.replace(/^\//, ''), `${config.baseUrl}/`);
}

function requestHeaders(config: CouncilPartnerConfig, environment: Environment) {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': 'What Bin Is It Tonight?/1.1 council-partner-gateway',
  };
  if (config.credentialEnv) {
    const credential = environment[config.credentialEnv];
    if (!credential) throw new Error(`Council connector credential ${config.credentialEnv} is not configured.`);
    const header = config.authHeader ?? 'authorization';
    const prefix = config.authScheme === undefined ? 'Bearer ' : config.authScheme ? `${config.authScheme} ` : '';
    headers[header] = `${prefix}${credential}`;
  }
  return headers;
}

async function partnerJson(
  config: CouncilPartnerConfig,
  url: URL,
  init: RequestInit,
  environment: Environment,
  fetcher: Fetcher,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), gatewayProviderBudgets.councilPartnerMs);
  try {
    const response = await fetcher(url, {
      ...init,
      headers: { ...requestHeaders(config, environment), ...init.headers },
      redirect: 'error',
      signal: controller.signal,
    });
    let payload: unknown;
    try {
      payload = await readBoundedUpstreamJson(response, maximumPartnerResponseBytes);
    } catch (error) {
      if (!isUpstreamResponseError(error, upstreamResponseErrorCodes.invalidJson)) throw error;
      payload = undefined;
    }
    if (!response.ok) {
      const detail = payload && typeof payload === 'object' && 'error' in payload
        && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error.slice(0, 160)
        : `The ${config.councilName} partner feed returned ${response.status}.`;
      throw new Error(detail);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`The ${config.councilName} partner feed timed out.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function addressesFromPayload(value: unknown): CouncilAddress[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { addresses?: unknown }).addresses)) {
    throw new Error('The council partner address feed returned an invalid response.');
  }
  return (value as { addresses: CouncilAddress[] }).addresses;
}

function collectionsFromPayload(
  config: CouncilPartnerConfig,
  value: unknown,
): CollectionOutput {
  if (!value || typeof value !== 'object') {
    throw new Error('The council partner collection feed returned an invalid response.');
  }
  const result = value as CollectionOutput;
  if (result.providerId !== config.providerId || result.councilName !== config.councilName) {
    throw new Error('The council partner collection feed identity did not match its connector.');
  }
  return result;
}

function servicesFromPayload(value: unknown): CouncilService[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { services?: unknown }).services)) {
    throw new Error('The council partner services feed returned an invalid response.');
  }
  return (value as { services: CouncilService[] }).services;
}

export function createCouncilPartnerAdapter(
  config: CouncilPartnerConfig,
  environment: Environment = process.env,
  fetcher: Fetcher = fetch,
): CouncilAdapter {
  const adapter: CouncilAdapter = {
    id: config.providerId,
    async getCollections(input) {
      const payload = await partnerJson(
        config,
        partnerUrl(config, '/v1/collections'),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            postcode: input.postcode,
            propertyReference: input.addressId,
          }),
        },
        environment,
        fetcher,
      );
      return collectionsFromPayload(config, payload);
    },
  };

  if (config.capabilities.includes('addresses')) {
    adapter.getAddresses = async (postcode) => {
      const url = partnerUrl(config, '/v1/addresses');
      url.searchParams.set('postcode', postcode);
      return addressesFromPayload(await partnerJson(config, url, { method: 'GET' }, environment, fetcher));
    };
  }

  if (config.capabilities.includes('services')) {
    adapter.getServices = async (input) => {
      const url = partnerUrl(config, '/v1/services');
      url.searchParams.set('postcode', input.postcode);
      return servicesFromPayload(await partnerJson(config, url, { method: 'GET' }, environment, fetcher));
    };
  }

  return adapter;
}

export function councilPartnerAdapterFor(
  providerId: string,
  environment: Environment = process.env,
  fetcher: Fetcher = fetch,
) {
  const config = parseCouncilPartnerRegistry(environment.COUNCIL_PARTNER_REGISTRY_JSON)
    .find((candidate) => candidate.providerId === providerId);
  return config ? createCouncilPartnerAdapter(config, environment, fetcher) : undefined;
}

export function councilPartnerRegistryStatus(environment: Environment = process.env) {
  try {
    const configs = parseCouncilPartnerRegistry(environment.COUNCIL_PARTNER_REGISTRY_JSON);
    return {
      configured: configs.length,
      providerIds: configs.map((config) => config.providerId),
      valid: true,
    };
  } catch {
    return {
      configured: 0,
      providerIds: [] as string[],
      valid: false,
      errorCode: 'COUNCIL_PARTNER_REGISTRY_INVALID' as const,
    };
  }
}
