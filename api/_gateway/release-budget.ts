export const gatewayPlatformMaximumMs = 30_000;
export const gatewayResponseHeadroomMs = 6_000;

export const gatewaySecurityBudgets = Object.freeze({
  workerRpcMs: 2_500,
  nodeConnectMs: 3_000,
  nodeStatementMs: 1_500,
  maximumOperationsPerRequest: 3,
});

export const gatewayProviderBudgets = Object.freeze({
  councilPartnerMs: 12_000,
  knowsleyAddressMs: 12_000,
  knowsleyCollectionMs: 15_000,
  nationwideFetchMs: 4_500,
  nationwideRetryDelayMs: 350,
  nationwideMaximumFetches: 3,
  postcodeLocationMs: 3_000,
  openStreetMapEndpointMs: 5_500,
  openStreetMapEndpointAttempts: 2,
});

export function gatewayWorstCaseBudgetsMs() {
  const workerSecurity = (
    gatewaySecurityBudgets.workerRpcMs
    * gatewaySecurityBudgets.maximumOperationsPerRequest
  );
  const nodeSecurity = (
    gatewaySecurityBudgets.nodeConnectMs
    + gatewaySecurityBudgets.nodeStatementMs * gatewaySecurityBudgets.maximumOperationsPerRequest
  );
  const security = Math.max(workerSecurity, nodeSecurity);
  return {
    knowsley: security + gatewayProviderBudgets.knowsleyCollectionMs,
    nationwide: security
      + gatewayProviderBudgets.nationwideFetchMs * gatewayProviderBudgets.nationwideMaximumFetches
      + gatewayProviderBudgets.nationwideRetryDelayMs,
    openStreetMap: security
      + gatewayProviderBudgets.postcodeLocationMs
      + gatewayProviderBudgets.openStreetMapEndpointMs
        * gatewayProviderBudgets.openStreetMapEndpointAttempts,
    partner: security + gatewayProviderBudgets.councilPartnerMs,
  };
}
