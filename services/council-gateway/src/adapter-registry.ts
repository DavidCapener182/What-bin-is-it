export type WasteType = 'general' | 'recycling' | 'garden' | 'food';

export type CollectionInput = { postcode: string; addressId?: string };
export type CollectionOutput = { councilName: string; providerId: string; verifiedAt: string; collections: { date: string; wasteType: WasteType }[]; notice?: string };
export type CouncilService = { id: string; name: string; type: 'recycling-centre' | 'recycling-point' | 'reuse' | 'collection'; address?: string; latitude: number; longitude: number; website?: string };
export type CouncilAdapter = { id: string; getCollections(input: CollectionInput): Promise<CollectionOutput>; getServices?(input: CollectionInput): Promise<CouncilService[]> };

/**
 * Add audited adapters here. Do not proxy arbitrary client-supplied URLs: a provider
 * is a controlled server-side integration with known source terms and validation.
 */
const demoAdapter: CouncilAdapter = {
  id: 'demo',
  async getCollections() {
    return {
      councilName: 'Demo Council',
      providerId: 'demo',
      verifiedAt: new Date().toISOString(),
      notice: 'Demo data only. This adapter is for contract checks, not a live collection calendar.',
      collections: [],
    };
  },
};

const adapters: Record<string, CouncilAdapter> = { demo: demoAdapter };

export function getAdapter(providerId: string) {
  return adapters[providerId];
}
