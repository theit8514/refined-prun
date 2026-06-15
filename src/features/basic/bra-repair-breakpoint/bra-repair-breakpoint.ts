import { refAttributeValue, refValue } from '@src/utils/reactive-dom';
import RepairBreakpoint from './RepairBreakpoint.vue';

async function onTileReady(tile: PrunTile) {
  // Gate on the repair panel itself rendering, so nothing is injected when the
  // tile fails to load its contents (e.g. the user lacks a PRO license).
  await $(tile.anchor, C.BuildingRepairAssistantPanel.buildingList);
  const siteSelect = await $(tile.anchor, 'select');
  const conditionSlider = await $(tile.anchor, 'rc-slider-handle');
  const commandRow = await $(tile.anchor, C.FormComponent.containerCommand);

  createFragmentApp(
    RepairBreakpoint,
    reactive({
      siteId: refValue(siteSelect),
      minCondition: refAttributeValue(conditionSlider, 'aria-valuenow'),
    }),
  ).before(commandRow);
}

function init() {
  tiles.observe('BRA', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'BRA: Adds whether the selected repair bill crosses a material breakpoint within 24h or 48h.',
);
