import { act } from '@src/features/XIT/ACT/act-registry';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';

interface Data {
  shipId: string;
}

export const OPEN_SHP = act.addActionStep<Data>({
  type: 'OPEN_SHP',
  description: data => {
    const ship = shipsStore.getById(data.shipId);
    const shipLabel = ship?.name ?? ship?.registration ?? 'unknown ship';
    return `Open SHP for ${shipLabel}`;
  },
  execute: async ctx => {
    const { data, requestTile, complete } = ctx;
    const assert: AssertFn = ctx.assert;

    const ship = shipsStore.getById(data.shipId);
    assert(ship, 'Ship not found');

    const tile = await requestTile(`SHP ${ship.registration}`);
    if (!tile) {
      return;
    }

    complete();
  },
});
