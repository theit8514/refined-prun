import { getSystemLineFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { planetsStore } from '@src/infrastructure/prun-api/data/planets';
import { stationsStore } from '@src/infrastructure/prun-api/data/stations';

export function formatAddressTargetLabel(naturalId: string) {
  const station = stationsStore.getByNaturalId(naturalId);
  if (station) {
    const systemNaturalId = getSystemLineFromAddress(station.address)?.entity.naturalId;
    const systemSuffix = systemNaturalId ? `, ${systemNaturalId}` : '';
    return `${station.name} (${station.naturalId}${systemSuffix})`;
  }

  const planet = planetsStore.getByNaturalId(naturalId);
  return planet ? `${planet.name} (${planet.naturalId})` : naturalId;
}

export function getAddressSearchQuery(naturalId: string) {
  const station = stationsStore.getByNaturalId(naturalId);
  if (station) {
    // Station name ranks first in address search; system codes match planets (e.g. ZV-307 → ZV-307e).
    return station.name;
  }

  const planet = planetsStore.getByNaturalId(naturalId);
  return planet?.name ?? naturalId;
}

export function getAddressMatchTerms(naturalId: string) {
  const station = stationsStore.getByNaturalId(naturalId);
  if (station) {
    return [station.name, station.naturalId];
  }

  const planet = planetsStore.getByNaturalId(naturalId);
  if (planet) {
    return [naturalId, planet.name];
  }

  return [naturalId];
}

/** Terms that appear in the AddressSelector after a target is selected (CXs show system id). */
export function getAddressSelectedMatchTerms(naturalId: string) {
  const station = stationsStore.getByNaturalId(naturalId);
  if (station) {
    const systemNaturalId = getSystemLineFromAddress(station.address)?.entity.naturalId;
    return [station.name, station.naturalId, systemNaturalId].filter(
      (x): x is string => x !== undefined,
    );
  }

  return getAddressMatchTerms(naturalId);
}
