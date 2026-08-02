import { after } from 'expo-widgets';

import BinNightLiveActivity from './BinNightLiveActivity.ios.tsx';
import type { CollectionLiveSurfaceSnapshot } from './collection-live-surface-data.ts';

export async function syncCollectionLiveSurface(snapshot?: CollectionLiveSurfaceSnapshot) {
  const instances = BinNightLiveActivity.getInstances();
  if (!snapshot) {
    await Promise.all(instances.map((instance) => instance.end('immediate')));
    return;
  }
  if (!instances.length) {
    BinNightLiveActivity.start(snapshot, 'whatbinistonight://');
    return;
  }
  await instances[0].update(snapshot);
  await Promise.all(instances.slice(1).map((instance) => instance.end('immediate')));
  if (snapshot.state === 'collected') {
    await instances[0].end(after(new Date(Date.now() + 15 * 60 * 1000)), snapshot, new Date());
  }
}
