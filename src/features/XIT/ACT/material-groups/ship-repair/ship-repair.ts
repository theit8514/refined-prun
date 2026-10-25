import { act } from '@src/features/XIT/ACT/act-registry';
import Edit from '@src/features/XIT/ACT/material-groups/ship-repair/Edit.vue';
import Configure from '@src/features/XIT/ACT/material-groups/ship-repair/Configure.vue';
import { Config } from '@src/features/XIT/ACT/material-groups/ship-repair/config';
import { configurableValue } from '@src/features/XIT/ACT/shared-types';
import { computeShipRepairBill } from '@src/features/XIT/ACT/material-groups/ship-repair/bill';
import {
  getShipsAtLocation,
  resolveShipRegistration,
} from '@src/features/XIT/ACT/material-groups/ship-repair/utils';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';

act.addMaterialGroup<Config>({
  type: 'Ship Repair',
  shortDescription: 'Calculate repair materials for a ship',
  description: data => {
    if (!data.location || !data.ship) {
      return '--';
    }

    const locationLabel = data.location === configurableValue ? '?' : data.location;
    const shipLabel = data.ship === configurableValue ? '?' : data.ship;
    return `Repair ${shipLabel} at ${locationLabel}`;
  },
  editComponent: Edit,
  configureComponent: Configure,
  needsConfigure: data => data.location === configurableValue || data.ship === configurableValue,
  isValidConfig: (data, config) =>
    (data.location !== configurableValue || config.location !== undefined) &&
    (data.ship !== configurableValue || config.ship !== undefined),
  generateMaterialBill: async ({ data, config, log }) => {
    if (!data.location) {
      log.error('Ship repair location is not configured');
      return undefined;
    }
    if (!data.ship) {
      log.error('Ship is not configured');
      return undefined;
    }

    const location = data.location === configurableValue ? config.location : data.location;
    if (!location) {
      log.error('Ship repair location is not configured');
      return undefined;
    }

    const registration = resolveShipRegistration(data.ship, config.ship);
    if (!registration) {
      log.error('Ship is not configured');
      return undefined;
    }

    const ship = shipsStore.getByRegistration(registration);
    if (!ship) {
      log.error(`Ship ${registration} not found`);
      return undefined;
    }

    const atLocation = getShipsAtLocation(location).some(x => x.id === ship.id);
    if (!atLocation) {
      log.error(`${ship.name ?? registration} is not at ${location}`);
      return undefined;
    }

    return computeShipRepairBill(ship);
  },
});
