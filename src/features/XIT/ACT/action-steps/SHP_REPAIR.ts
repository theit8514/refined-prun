import { act } from '@src/features/XIT/ACT/act-registry';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { clickElement } from '@src/util';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';
import { pollUntil } from '@src/features/XIT/ACT/action-steps/cont-utils';

interface Data {
  shipId: string;
}

export const SHP_REPAIR = act.addActionStep<Data>({
  type: 'SHP_REPAIR',
  description: data => {
    const ship = shipsStore.getById(data.shipId);
    const shipLabel = ship?.name ?? ship?.registration ?? 'unknown ship';
    return `Repair ${shipLabel}`;
  },
  execute: async ctx => {
    const { data, log, setStatus, requestTile, waitAct, waitActionFeedback, complete, fail } = ctx;
    const assert: AssertFn = ctx.assert;

    const ship = shipsStore.getById(data.shipId);
    assert(ship, 'Ship not found');

    // Reuses the tile from OPEN_SHP when still open (no second Open waitAct).
    const tile = await requestTile(`SHP ${ship.registration}`);
    if (!tile) {
      return;
    }

    // SHP repair is the primary CMD button (same pattern as SHPI unload).
    const button = (await $(tile.anchor, C.Button.primary)) as HTMLButtonElement;
    if (button.disabled || button.classList.contains(C.Button.disabled)) {
      fail('Repair button is disabled (wrong location or ship does not need repair)');
    }

    await waitAct(`Repair ${ship.name ?? ship.registration}?`);
    const before = shipsStore.getById(data.shipId)?.condition ?? ship.condition;
    await clickElement(button);
    await waitActionFeedback(tile);
    setStatus('Waiting for ship condition update...');
    const updated = await pollUntil(() => {
      const current = shipsStore.getById(data.shipId);
      return current !== undefined && current.condition !== before ? current : undefined;
    }, 8000);
    if (!updated) {
      log.warning('Ship condition did not update in time; continuing');
    }

    complete();
  },
});
