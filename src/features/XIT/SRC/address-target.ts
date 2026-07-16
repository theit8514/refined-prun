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
    return station.naturalId;
  }

  const planet = planetsStore.getByNaturalId(naturalId);
  return planet?.name ?? naturalId;
}

export function getAddressMatchTerms(naturalId: string) {
  const station = stationsStore.getByNaturalId(naturalId);
  if (station) {
    const systemNaturalId = getSystemLineFromAddress(station.address)?.entity.naturalId;
    return [station.naturalId, station.name, systemNaturalId].filter(
      (x): x is string => x !== undefined,
    );
  }

  const planet = planetsStore.getByNaturalId(naturalId);
  if (planet) {
    return [naturalId, planet.name];
  }

  return [naturalId];
}
