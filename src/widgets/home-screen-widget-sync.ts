import type { Collection, SavedAddress } from '../lib/types.ts';

export type HomeScreenWidgetInput = {
  address: SavedAddress | undefined;
  collections: Collection[];
};

export async function syncHomeScreenWidget(_input: HomeScreenWidgetInput) {
  // The web and generic bundle deliberately have no operating-system widget API.
}
