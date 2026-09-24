import STO from '@src/features/XIT/STO/STO.vue';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { getEntityNameFromAddress } from '@src/infrastructure/prun-api/data/addresses';

xit.add({
  command: ['STO', 'STORAGE'],
  name: parameters => {
    if (parameters[0] && !parameters[1]) {
      const site = sitesStore.getByPlanetNaturalIdOrName(parameters[0]);
      if (site) {
        return `Storage - ${getEntityNameFromAddress(site.address)}`;
      }
    }
    return 'Storage Analysis';
  },
  description: 'Per-base storage analysis.',
  optionalParameters: 'Planet Identifier(s), NOT',
  component: () => STO,
  bufferSize: [900, 500],
});
