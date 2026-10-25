import {
  atSameLocation,
  deserializeStorage,
  serializeStorage,
  storageSort,
} from '@src/features/XIT/ACT/actions/utils';
import { configurableValue } from '@src/features/XIT/ACT/shared-types';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { percent0 } from '@src/utils/format';

export function getRepairLocations() {
  return (storagesStore.nonFuelStores.value ?? [])
    .filter(x => x.type === 'STORE' || x.type === 'WAREHOUSE_STORE')
    .sort(storageSort);
}

export function getRepairLocationOptions(includeConfigure: boolean) {
  const options = getRepairLocations().map(serializeStorage);
  if (includeConfigure) {
    options.unshift(configurableValue);
  }
  return options;
}

export function getShipsAtLocation(serializedLocation: string | undefined) {
  const location = deserializeStorage(serializedLocation);
  if (!location) {
    return [];
  }

  const ships: PrunApi.Ship[] = [];
  for (const store of storagesStore.getByType('SHIP_STORE') ?? []) {
    if (!atSameLocation(store, location)) {
      continue;
    }
    const ship = shipsStore.getById(store.addressableId);
    if (ship) {
      ships.push(ship);
    }
  }
  ships.sort((a, b) => a.condition - b.condition);
  return ships;
}

export function formatShipOption(ship: PrunApi.Ship) {
  return {
    label: `${ship.registration} - ${ship.name} (${percent0(ship.condition)})`,
    value: ship.registration,
  };
}

export function getAllShipsSortedByName() {
  return [...(shipsStore.all.value ?? [])].sort((a, b) => a.name.localeCompare(b.name));
}

// Edit window: all ships by name, plus Configure on Execution.
export function getEditShipOptions() {
  const options: Array<string | { label: string; value: string }> =
    getAllShipsSortedByName().map(formatShipOption);
  options.unshift(configurableValue);
  return options;
}

// Configure window: ships at the selected location, worst condition first.
export function getShipOptions(serializedLocation: string | undefined, includeConfigure: boolean) {
  if (serializedLocation === configurableValue || !serializedLocation) {
    return includeConfigure ? [configurableValue] : [];
  }

  const options: Array<string | { label: string; value: string }> =
    getShipsAtLocation(serializedLocation).map(formatShipOption);
  if (includeConfigure) {
    options.unshift(configurableValue);
  }
  return options;
}

export function resolveShipRegistration(ship: string | undefined, configShip: string | undefined) {
  if (!ship) {
    return undefined;
  }
  if (ship === configurableValue) {
    return configShip;
  }
  return ship;
}
