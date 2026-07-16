import { changeInputValue, clickElement, focusElement } from '@src/util';
import { getAddressMatchTerms, getAddressSearchQuery } from '@src/features/XIT/SRC/address-target';
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

function findMatchingSuggestion(suggestionsList: Element, naturalId: string) {
  const terms = getAddressMatchTerms(naturalId);
  return _$$(suggestionsList, C.AddressSelector.suggestion).find(x => {
    const text = x.textContent ?? '';
    return terms.some(term => text.includes(term));
  });
}

/** Wait until the portalled address search finishes and a matching row appears. */
async function waitForAddressSearchResults(naturalId: string) {
  const query = getAddressSearchQuery(naturalId);
  const app = await $(document, C.App.container);

  await $(app, C.AddressSelector.suggestionsContainerOpen);
  const suggestionsList = await $(app, C.AddressSelector.suggestionsList);

  const existing = findMatchingSuggestion(suggestionsList, naturalId);
  if (existing) {
    return existing;
  }

  return await new Promise<HTMLElement>((resolve, reject) => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Address search timed out for ${query}`));
    }, 60_000);

    const observer = new MutationObserver(() => {
      const match = findMatchingSuggestion(suggestionsList, naturalId);
      if (match) {
        clearTimeout(timeout);
        observer.disconnect();
        resolve(match);
      }
    });
    observer.observe(suggestionsList, { childList: true, subtree: true });
  });
}

async function selectAddress(row: HTMLElement, naturalId: string) {
  const query = getAddressSearchQuery(naturalId);

  let container: Element = row;
  if (!container.classList.contains(C.AddressSelector.container)) {
    container = (await $(row, C.AddressSelector.container)) as HTMLElement;
  }

  const input = (await $(container, C.AddressSelector.input)) as HTMLInputElement;
  focusElement(input);
  changeInputValue(input, query);

  try {
    const match = await waitForAddressSearchResults(naturalId);
    const app = await $(document, C.App.container);
    const suggestionsContainer = _$(app, C.AddressSelector.suggestionsContainer);
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
    await clickElement(match);
    if (suggestionsContainer) {
      suggestionsContainer.style.display = '';
    }
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : `Address suggestion not found for ${query}`;
  }
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

async function clickSliderAtPercent(slider: HTMLElement, percent: 0 | 50 | 100) {
  const rail = (_$(slider, 'rc-slider-rail') ?? slider) as HTMLElement;
  const ratio = percent / 100;
  const rect = rail.getBoundingClientRect();
  const clientX = rect.left + rect.width * ratio;
  const clientY = rect.top + rect.height / 2;
  const eventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    view: window,
  };

  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const) {
    rail.dispatchEvent(new MouseEvent(type, eventInit));
    await sleep(0);
  }
}

async function setFuelUsage(tile: PrunTile, percent: 0 | 50 | 100) {
  const row = findFuelUsageRow(tile);
  if (!row) {
    return 'Fuel usage field not found';
  }

  const slider = findFuelUsageSlider(row);
  if (slider) {
    await clickSliderAtPercent(slider, percent);
    return undefined;
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
  return selectAddress(originRow, origin);
}

export async function applyBtfDestination(tile: PrunTile, destination: string) {
  const destinationRow = findFormRow(tile, L.BlueprintTestFlight.label.destination());
  if (!destinationRow) {
    return 'Destination field not found';
  }
  return selectAddress(destinationRow, destination);
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
  const labelText = L.RoutePreferencesSelect.label.useGateways();
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

function isUseGatewaysEnabled(toggle: HTMLElement) {
  return toggle.classList.contains(C.RadioItem.active) || !!_$(toggle, C.RadioItem.active);
}

/**
 * Disable Use gateways under FTL preferences.
 * Returns whether a click was performed (false = already off).
 */
export async function disableBtfUseGateways(tile: PrunTile) {
  const toggle = findUseGatewaysToggle(tile);
  if (!toggle) {
    return { error: 'Use gateways toggle not found', clicked: false };
  }
  if (!isUseGatewaysEnabled(toggle)) {
    return { error: undefined, clicked: false };
  }
  await clickElement(toggle);
  return { error: undefined, clicked: true };
}
