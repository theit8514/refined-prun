import { changeSelectIndex } from '@src/util';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { waitUntil } from '@src/utils/wait';
import { watchUntil } from '@src/utils/watch';

const INITIAL_SITE = 'PLAYER_INITIAL_SITE';
const REGULAR_SITE = 'PLAYER_SITE';

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, 'select'), select => {
    void setDefaultBuildOption(select);
  });
}

async function setDefaultBuildOption(select: HTMLSelectElement) {
  if (!isBuildOptionsSelect(select)) {
    // Options may hydrate after the select mounts.
    if (select.options.length > 0) {
      return;
    }
    const ready = await waitUntil(() => select.options.length > 0 || !select.isConnected, 10_000);
    if (!ready || !select.isConnected || !isBuildOptionsSelect(select)) {
      return;
    }
  }

  await watchUntil(() => sitesStore.fetched.value);

  // Keep the game default (Core Module Kit) when no bases exist.
  if (!sitesStore.all.value?.length) {
    return;
  }

  if (select.value === REGULAR_SITE) {
    return;
  }

  const index = Array.from(select.options).findIndex(x => x.value === REGULAR_SITE);
  if (index < 0) {
    return;
  }

  changeSelectIndex(select, index);
}

function isBuildOptionsSelect(select: HTMLSelectElement) {
  const values = Array.from(select.options).map(x => x.value);
  return values.includes(INITIAL_SITE) && values.includes(REGULAR_SITE);
}

function init() {
  tiles.observe('BSC', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'BSC: Defaults Build Options to Regular Building Materials when bases exist.',
);
