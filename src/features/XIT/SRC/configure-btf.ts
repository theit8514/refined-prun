import { changeInputValue, changeSelectIndex, clickElement } from '@src/util';
import { getAddressSelectedMatchTerms } from '@src/features/XIT/SRC/address-target';
import { selectAddressInSelector } from '@src/infrastructure/prun-ui/address-selector';
import { UI_TILES_CHANGE_COMMAND } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { sleep } from '@src/utils/sleep';

export interface BtfFuelPreset {
  id: string;
  label: string;
  /** 0 = slider minimum, 50 = midpoint, 100 = maximum. */
  percent: 0 | 50 | 100;
}

export const BTF_FUEL_PRESETS: BtfFuelPreset[] = [
  { id: 'min', label: 'Fuel minimum', percent: 0 },
  { id: '50', label: 'Fuel 50%', percent: 50 },
  { id: '100', label: 'Fuel 100%', percent: 100 },
];

function formRows(tile: PrunTile) {
  return [
    ..._$$(tile.anchor, C.FormComponent.containerActive),
    ..._$$(tile.anchor, C.FormComponent.containerPassive),
  ];
}

function rowLabelText(row: HTMLElement) {
  const label = _$(row, 'label');
  const span = label ? _$(label, 'span') : undefined;
  return span?.textContent?.trim();
}

function findFormRow(tile: PrunTile, labelText: string | undefined) {
  if (!labelText) {
    return undefined;
  }
  return formRows(tile).find(x => rowLabelText(x) === labelText);
}

function findFuelUsageRow(tile: PrunTile) {
  return findFormRow(tile, L.BlueprintTestFlight.label.fuelUsage());
}

function findFuelUsageSlider(row: HTMLElement) {
  return _$(row, 'rc-slider') as HTMLElement | undefined;
}

async function ensureFuelUsageRow(tile: PrunTile) {
  const existing = findFuelUsageRow(tile);
  if (existing) {
    return existing;
  }

  return await new Promise<HTMLElement>((resolve, reject) => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('Fuel usage field not found'));
    }, 60_000);

    const observer = new MutationObserver(() => {
      const row = findFuelUsageRow(tile);
      if (row) {
        clearTimeout(timeout);
        observer.disconnect();
        resolve(row);
      }
    });
    observer.observe(tile.anchor, { childList: true, subtree: true });
  });
}

/** Wait until the fuel usage row contains its 0–100% slider. */
export async function waitForFuelUsageSlider(tile: PrunTile) {
  try {
    const row = await ensureFuelUsageRow(tile);
    if (findFuelUsageSlider(row)) {
      return undefined;
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        observer.disconnect();
        reject(new Error('Timed out waiting for fuel usage slider'));
      }, 60_000);

      const observer = new MutationObserver(() => {
        if (findFuelUsageSlider(row)) {
          clearTimeout(timeout);
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(row, { childList: true, subtree: true, attributes: true });
    });
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : 'Timed out waiting for fuel usage slider';
  }
}

interface RcSliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  onChangeComplete?: (value: number) => void;
  onAfterChange?: (value: number) => void;
}

function getRcSliderProps(slider: HTMLElement): RcSliderProps | undefined {
  const key = Object.keys(slider).find(
    x => x.startsWith('__reactFiber') || x.startsWith('__reactInternalInstance'),
  );
  if (!key) {
    return undefined;
  }

  let fiber = (
    slider as unknown as Record<string, { return?: unknown; memoizedProps?: RcSliderProps }>
  )[key];
  for (let i = 0; i < 20 && fiber; i++, fiber = fiber.return as typeof fiber) {
    const props = fiber.memoizedProps;
    if (props && typeof props.onChange === 'function') {
      return props;
    }
  }
  return undefined;
}

function snapSliderValue(value: number, min: number, max: number, step: number) {
  const steps = Math.round((value - min) / step);
  const snapped = min + steps * step;
  // Avoid float drift (e.g. 0.30000000000000004).
  const precision = Math.max(0, Math.round(-Math.log10(step)));
  const rounded = Number(snapped.toFixed(precision));
  return Math.min(max, Math.max(min, rounded));
}

/** Map 0/50/100 presets onto slider min/mid/max via React props (one server round-trip). */
function setRcSliderPercent(slider: HTMLElement, percent: 0 | 50 | 100) {
  const props = getRcSliderProps(slider);
  if (!props?.onChange) {
    return 'Slider React props not found';
  }

  const min = Number(props.min ?? 0);
  const max = Number(props.max ?? 1);
  const step = Number(props.step ?? 0.01);
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    max === min ||
    !Number.isFinite(step) ||
    step <= 0
  ) {
    return 'Invalid slider range';
  }

  let raw: number;
  if (percent === 0) {
    raw = min;
  } else if (percent === 100) {
    raw = max;
  } else if (max <= 1 && 0.5 >= min && 0.5 <= max) {
    // Fuel scale is ~0–1; prefer exact 0.5 over range midpoint (which snaps to 0.51).
    raw = 0.5;
  } else {
    raw = min + (max - min) / 2;
  }

  const value = snapSliderValue(raw, min, max, step);
  props.onChange(value);
  // onChange updates the handle; complete/after triggers the MissionPlan server call.
  props.onChangeComplete?.(value);
  props.onAfterChange?.(value);
  return undefined;
}

function setFuelUsage(tile: PrunTile, percent: 0 | 50 | 100) {
  const row = findFuelUsageRow(tile);
  if (!row) {
    return 'Fuel usage field not found';
  }

  const slider = findFuelUsageSlider(row);
  if (slider) {
    return setRcSliderPercent(slider, percent);
  }

  const input = _$(row, 'input') as HTMLInputElement | undefined;
  if (!input) {
    return 'Fuel usage control not found';
  }

  changeInputValue(input, String(percent));
  return undefined;
}

export async function applyBtfOrigin(tile: PrunTile, origin: string) {
  const originRow = findFormRow(tile, L.BlueprintTestFlight.label.origin());
  if (!originRow) {
    return 'Origin field not found';
  }
  return selectAddressInSelector(originRow, origin);
}

export async function applyBtfDestination(tile: PrunTile, destination: string) {
  const destinationRow = findFormRow(tile, L.BlueprintTestFlight.label.destination());
  if (!destinationRow) {
    return 'Destination field not found';
  }
  return selectAddressInSelector(destinationRow, destination);
}

/** True when the BTF origin AddressSelector already shows the given target. */
export function isBtfOriginSet(tile: PrunTile, naturalId: string) {
  return isBtfAddressSet(tile, L.BlueprintTestFlight.label.origin(), naturalId);
}

/** True when the BTF destination AddressSelector already shows the given target. */
export function isBtfDestinationSet(tile: PrunTile, naturalId: string) {
  return isBtfAddressSet(tile, L.BlueprintTestFlight.label.destination(), naturalId);
}

export function isBtfRouteSet(tile: PrunTile, origin: string, destination: string) {
  return isBtfOriginSet(tile, origin) && isBtfDestinationSet(tile, destination);
}

function isBtfAddressSet(tile: PrunTile, label: string | undefined, naturalId: string) {
  const row = findFormRow(tile, label);
  if (!row) {
    return false;
  }
  const container = (_$(row, C.AddressSelector.container) as HTMLElement | undefined) ?? row;
  const input = _$(container, C.AddressSelector.input) as HTMLInputElement | undefined;
  // Selected CXs display the system code (e.g. ZV-307) in the input, not the station name.
  const value = input?.value?.trim() ?? '';
  if (value !== '' && getAddressSelectedMatchTerms(naturalId).includes(value)) {
    return true;
  }
  const text = container.textContent?.trim() ?? '';
  return getAddressSelectedMatchTerms(naturalId).some(term => text === term || text.includes(term));
}

/** Clear a BTF tile via the : control (same as changing buffer command). */
export async function clearBtfBuffer(tile: PrunTile) {
  const tileEl = tile.frame.parentElement;
  if (!tileEl) {
    return 'Tile element not found';
  }

  const message = UI_TILES_CHANGE_COMMAND(tile.id, null);
  if (!dispatchClientPrunMessage(message)) {
    const changeButton = _$$(tileEl, C.TileControls.control).find(x => x.textContent === ':');
    if (!changeButton) {
      return 'Tile clear button not found';
    }
    await clickElement(changeButton);
  } else {
    await sleep(0);
  }

  await $(tileEl, C.PanelSelector.input);
  return undefined;
}

export async function ensureBtfRouteMatches(
  blueprintNaturalId: string,
  origin: string,
  destination: string,
) {
  const tile = tiles.find(`BTF ${blueprintNaturalId}`, true)[0];
  if (!tile) {
    return { cleared: false };
  }

  try {
    await $(tile.anchor, C.AddressSelector.container);
  } catch {
    const error = await clearBtfBuffer(tile);
    return { cleared: !error, error };
  }

  if (isBtfRouteSet(tile, origin, destination)) {
    return { cleared: false };
  }

  const error = await clearBtfBuffer(tile);
  return { cleared: !error, error };
}

export async function applyBtfFuelUsage(tile: PrunTile, percent: 0 | 50 | 100) {
  const waitError = await waitForFuelUsageSlider(tile);
  if (waitError) {
    return waitError;
  }
  return setFuelUsage(tile, percent);
}

function missionPlanTable(tile: PrunTile) {
  return _$(tile.anchor, C.MissionPlan.table) as HTMLElement | undefined;
}

/** Cell text only — table is reused; server updates values in place. */
function missionPlanSignature(table: HTMLElement) {
  return Array.from(table.querySelectorAll('td'))
    .map(x => x.textContent?.trim() ?? '')
    .join('\0');
}

function snapshotMissionPlan(tile: PrunTile) {
  const table = missionPlanTable(tile);
  if (!table) {
    return null;
  }
  const signature = missionPlanSignature(table);
  if (signature === '') {
    return null;
  }
  return signature;
}

function isMissionPlanUpdated(tile: PrunTile, before: string | null) {
  const table = missionPlanTable(tile);
  if (!table) {
    return false;
  }
  const signature = missionPlanSignature(table);
  if (signature === '') {
    return false;
  }
  if (before === null) {
    return true;
  }
  return signature !== before;
}

function watchMissionPlanUpdate(tile: PrunTile, before: string | null) {
  let settled = false;
  let resolve!: (error: string | undefined) => void;
  const promise = new Promise<string | undefined>(r => {
    resolve = r;
  });

  const finish = (error?: string) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timeout);
    clearInterval(poll);
    observer.disconnect();
    resolve(error);
  };

  const check = () => {
    if (isMissionPlanUpdated(tile, before)) {
      finish();
    }
  };

  const timeout = setTimeout(() => finish('Timed out waiting for MissionPlan update'), 60_000);
  // Value-only updates mutate text nodes; childList alone is not enough.
  const observer = new MutationObserver(check);
  observer.observe(tile.anchor, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
  // Poll in case a mutation is coalesced or missed.
  const poll = setInterval(check, 200);

  return {
    promise,
    cancel: () => finish(),
  };
}

/**
 * Snapshot MissionPlan, run action, wait for cell values to change.
 * Observer starts before the action so fast updates are not missed.
 * Pass `skipWait: true` from action when no server recalculation is expected.
 */
export async function runAndWaitMissionPlanUpdate(
  tile: PrunTile,
  action: () => Promise<string | undefined | { error?: string; skipWait?: boolean }>,
) {
  const before = snapshotMissionPlan(tile);
  const wait = watchMissionPlanUpdate(tile, before);
  const result = await action();
  const error = typeof result === 'string' ? result : result?.error;
  const skipWait = typeof result === 'object' && result?.skipWait === true;
  if (error) {
    wait.cancel();
    return error;
  }
  if (skipWait) {
    wait.cancel();
    return undefined;
  }
  if (isMissionPlanUpdated(tile, before)) {
    wait.cancel();
    return undefined;
  }
  return wait.promise;
}

function findUseGatewaysToggle(tile: PrunTile) {
  return findRadioItem(tile, L.RoutePreferencesSelect.label.useGateways());
}

function findRadioItem(tile: PrunTile, labelText: string | undefined) {
  if (!labelText) {
    return undefined;
  }
  const container =
    _$(tile.anchor, C.RoutePreferencesSelect.container) ??
    findFormRow(tile, L.BlueprintTestFlight.label.ftlPreferences()) ??
    tile.anchor;

  const value = _$$(container, C.RadioItem.value).find(x => x.textContent?.trim() === labelText);
  if (!value) {
    return undefined;
  }
  return (value.closest(`.${C.RadioItem.container}`) as HTMLElement | null) ?? undefined;
}

function isRadioItemActive(toggle: HTMLElement) {
  return toggle.classList.contains(C.RadioItem.active) || !!_$(toggle, C.RadioItem.active);
}

async function setRadioItem(tile: PrunTile, labelText: string | undefined, enabled: boolean) {
  const toggle = findRadioItem(tile, labelText);
  if (!toggle) {
    return { error: `Option not found: ${labelText ?? '?'}`, clicked: false };
  }
  if (isRadioItemActive(toggle) === enabled) {
    return { error: undefined, clicked: false };
  }
  await clickElement(toggle);
  return { error: undefined, clicked: true };
}

function findPayloadRow(tile: PrunTile) {
  return findFormRow(tile, L.BlueprintTestFlight.label.payload());
}

function getSliderPercent(slider: HTMLElement) {
  const handle = _$(slider, 'rc-slider-handle') as HTMLElement | undefined;
  if (!handle) {
    return undefined;
  }
  // Prefer visual position — inventory uses absolute tons in aria-valuenow.
  const left = handle.style.left;
  if (left.endsWith('%')) {
    const value = parseFloat(left);
    return Number.isFinite(value) ? value : undefined;
  }
  const aria = handle.getAttribute('aria-valuenow');
  if (aria === null || aria === '') {
    return undefined;
  }
  const value = Number(aria);
  const min = Number(handle.getAttribute('aria-valuemin') ?? '0');
  const max = Number(handle.getAttribute('aria-valuemax') ?? '100');
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return undefined;
  }
  return ((value - min) / (max - min)) * 100;
}

async function setPayloadInventory(tile: PrunTile, full: boolean) {
  const row = findPayloadRow(tile);
  if (!row) {
    return { error: 'Inventory field not found', clicked: false };
  }
  const slider = findFuelUsageSlider(row);
  if (!slider) {
    return { error: 'Inventory slider not found', clicked: false };
  }

  const desired = full ? 100 : 0;
  const current = getSliderPercent(slider);
  if (current !== undefined && Math.abs(current - desired) < 1) {
    return { error: undefined, clicked: false };
  }

  const error = setRcSliderPercent(slider, desired);
  return { error, clicked: !error };
}

export function isBtfPayloadInventorySet(tile: PrunTile, full: boolean) {
  const row = findPayloadRow(tile);
  const slider = row ? findFuelUsageSlider(row) : undefined;
  if (!slider) {
    return false;
  }
  const desired = full ? 100 : 0;
  const current = getSliderPercent(slider);
  return current !== undefined && Math.abs(current - desired) < 1;
}

export async function applyBtfPayloadInventory(tile: PrunTile, full: boolean) {
  return setPayloadInventory(tile, full);
}

function findFtlPreferencesSelect(tile: PrunTile) {
  const row = findFormRow(tile, L.BlueprintTestFlight.label.ftlPreferences());
  if (!row) {
    return undefined;
  }
  const container = _$(row, C.RoutePreferencesSelect.container) ?? row;
  return (container.querySelector('select') ?? _$(container, 'select')) as
    | HTMLSelectElement
    | undefined;
}

function ftlModeLabel(mode: BtfFtlMode) {
  return mode === 'leastJumps'
    ? L.RoutePreferencesSelect.value.leastJumps()
    : L.RoutePreferencesSelect.value.shortestFTL();
}

function findFtlModeOptionIndex(select: HTMLSelectElement, mode: BtfFtlMode) {
  const label = ftlModeLabel(mode)?.trim();
  if (!label) {
    return -1;
  }
  return Array.from(select.options).findIndex(x => x.textContent?.trim() === label);
}

export function isBtfFtlModeSet(tile: PrunTile, mode: BtfFtlMode) {
  const select = findFtlPreferencesSelect(tile);
  if (!select) {
    return false;
  }
  const index = findFtlModeOptionIndex(select, mode);
  return index >= 0 && select.selectedIndex === index;
}

export function applyBtfFtlMode(tile: PrunTile, mode: BtfFtlMode) {
  const select = findFtlPreferencesSelect(tile);
  if (!select) {
    return { error: 'FTL preferences dropdown not found', clicked: false };
  }
  const index = findFtlModeOptionIndex(select, mode);
  if (index < 0) {
    return { error: `FTL mode option not found: ${ftlModeLabel(mode) ?? mode}`, clicked: false };
  }
  if (select.selectedIndex === index) {
    return { error: undefined, clicked: false };
  }
  changeSelectIndex(select, index);
  return { error: undefined, clicked: true };
}

export type BtfFtlMode = 'leastJumps' | 'shortestFTL';

export function isBtfUseGatewaysEnabled(tile: PrunTile) {
  const toggle = findUseGatewaysToggle(tile);
  if (!toggle) {
    return undefined;
  }
  return isRadioItemActive(toggle);
}

export async function applyBtfUseGateways(tile: PrunTile, enabled: boolean) {
  return setRadioItem(tile, L.RoutePreferencesSelect.label.useGateways(), enabled);
}

export async function disableBtfUseGateways(tile: PrunTile) {
  return applyBtfUseGateways(tile, false);
}
