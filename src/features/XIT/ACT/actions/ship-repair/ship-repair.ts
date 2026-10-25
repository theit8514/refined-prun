import { act } from '@src/features/XIT/ACT/act-registry';
import Edit from '@src/features/XIT/ACT/actions/ship-repair/Edit.vue';
import { OPEN_SHP } from '@src/features/XIT/ACT/action-steps/OPEN_SHP';
import { SHP_REPAIR } from '@src/features/XIT/ACT/action-steps/SHP_REPAIR';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';

act.addAction({
  type: 'Ship Repair',
  shortDescription: 'Open SHP and repair the ship from a Ship Repair material group',
  description: action => {
    if (!action.group) {
      return '--';
    }
    return `Repair ship from group ${action.group}`;
  },
  editComponent: Edit,
  generateSteps: async ctx => {
    const { data, getMaterialGroupShip, emitStep } = ctx;
    const assert: AssertFn = ctx.assert;

    assert(data.group, 'Missing material group');
    const registration = getMaterialGroupShip(data.group);
    assert(registration, 'Invalid ship');

    const ship = shipsStore.getByRegistration(registration);
    assert(ship, `Ship ${registration} not found`);

    emitStep(OPEN_SHP({ shipId: ship.id }));
    emitStep(SHP_REPAIR({ shipId: ship.id }));
  },
});
