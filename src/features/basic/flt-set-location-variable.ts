import SetLocationVariableButton from '@src/components/SetLocationVariableButton.vue';
import { refPrunId } from '@src/infrastructure/prun-ui/attributes';
import { flightsStore } from '@src/infrastructure/prun-api/data/flights';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { ElementTag } from '@src/infrastructure/prun-ui/tagger';
import { keepLast } from '@src/utils/keep-last';

function mountButton(
  row: HTMLElement,
  cellTag: ElementTag,
  address: ComputedRef<PrunApi.Address | null | undefined>,
  marker: string,
) {
  if (row.querySelector(`[data-rp-set-location-variable="${marker}"]`)) {
    return;
  }
  const mount = document.createElement('span');
  mount.dataset.rpSetLocationVariable = marker;
  // Attach before Vue mount — appendTo unmounts immediately if the parent is disconnected.
  keepLast(row, () => _$(row, cellTag), mount);
  createFragmentApp(SetLocationVariableButton, reactive({ address })).appendTo(mount);
}

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, 'tr'), async row => {
    if (_$(row, 'th')) {
      return;
    }

    const id = refPrunId(row);
    const ship = computed(() => shipsStore.getById(id.value));
    const location = computed(() => ship.value?.address);
    const destination = computed(() => flightsStore.getById(ship.value?.flightId)?.destination);

    await $(row, ElementTag.FLT_LOCATION_CELL);
    await $(row, ElementTag.FLT_DESTINATION_CELL);
    mountButton(row, ElementTag.FLT_LOCATION_CELL, location, 'location');
    mountButton(row, ElementTag.FLT_DESTINATION_CELL, destination, 'destination');
  });
}

function init() {
  tiles.observe(['FLT', 'FLTS', 'FLTP'], onTileReady);
}

features.add(
  import.meta.url,
  init,
  'FLT: Adds buttons to set screen location variables from Location and Destination.',
);
