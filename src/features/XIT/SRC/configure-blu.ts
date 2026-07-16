import { changeSelectIndex, clickElement } from '@src/util';
import { lookupLocalization } from '@src/infrastructure/prun-ui/i18n';

/** Optional shield slots used by the ship repair calculator (no gravity/stability). */
export type ShieldSlot = 'HEAT_SHIELD' | 'WHIPPLE_SHIELD' | 'RADIATION_SHIELD';

export type BluShieldConfig = Record<ShieldSlot, string>;

export interface BluShieldPreset {
  id: string;
  label: string;
  shields: BluShieldConfig;
}

/**
 * Repair-calculator shield presets:
 * 1. Base trip (no shields)
 * 2–4. Single shield type (ATP / AWH / SRP), replacing the previous.
 */
export const BLU_SHIELD_PRESETS: BluShieldPreset[] = [
  {
    id: 'base',
    label: 'Base (no shields)',
    shields: {
      HEAT_SHIELD: '',
      WHIPPLE_SHIELD: '',
      RADIATION_SHIELD: '',
    },
  },
  {
    id: 'atp',
    label: 'ATP (advanced heat)',
    shields: {
      HEAT_SHIELD: 'HEAT_SHIELD_ADVANCED',
      WHIPPLE_SHIELD: '',
      RADIATION_SHIELD: '',
    },
  },
  {
    id: 'awh',
    label: 'AWH (advanced whipple)',
    shields: {
      HEAT_SHIELD: '',
      WHIPPLE_SHIELD: 'WHIPPLE_SHIELD_ADVANCED',
      RADIATION_SHIELD: '',
    },
  },
  {
    id: 'srp',
    label: 'SRP (specialized radiation)',
    shields: {
      HEAT_SHIELD: '',
      WHIPPLE_SHIELD: '',
      RADIATION_SHIELD: 'RADIATION_SHIELD_SPECIALIZED',
    },
  },
];

const SHIELD_SLOTS: ShieldSlot[] = ['HEAT_SHIELD', 'WHIPPLE_SHIELD', 'RADIATION_SHIELD'];

function shieldLabel(slot: ShieldSlot) {
  return lookupLocalization(L.BlueprintComponentType, slot)?.name?.() ?? slot;
}

function isEmptyOption(option: HTMLOptionElement) {
  // Empty: value="" or bare `value` attribute (both normalize to "").
  if (option.value === '') {
    return true;
  }
  return option.textContent?.trim() === '--';
}

function findOptionIndex(select: HTMLSelectElement, optionValue: string) {
  const options = Array.from(select.options);
  if (optionValue === '') {
    return options.findIndex(isEmptyOption);
  }
  return options.findIndex(x => x.value === optionValue);
}

function findShieldSelect(tile: PrunTile, slot: ShieldSlot) {
  const labelText = shieldLabel(slot);
  const rows = [
    ..._$$(tile.anchor, C.FormComponent.containerActive),
    ..._$$(tile.anchor, C.FormComponent.containerPassive),
  ];
  // Label text lives in a <span>; sibling ⓘ tooltip must not be part of the match.
  const row = rows.find(x => {
    const label = _$(x, 'label');
    const span = label ? _$(label, 'span') : undefined;
    return span?.textContent?.trim() === labelText;
  });
  if (!row) {
    return undefined;
  }
  const selector = _$(row, C.ComponentOptionSelection.selector);
  return (selector?.querySelector('select') ?? _$(row, 'select')) as HTMLSelectElement | undefined;
}

function setShieldSelect(select: HTMLSelectElement, optionValue: string) {
  const index = findOptionIndex(select, optionValue);
  if (index < 0) {
    return false;
  }
  if (select.selectedIndex !== index) {
    changeSelectIndex(select, index);
  }
  return true;
}

function getShieldSelectValue(select: HTMLSelectElement) {
  const option = select.options[select.selectedIndex];
  if (option === undefined || isEmptyOption(option)) {
    return '';
  }
  return option.value;
}

function getCurrentBluShieldConfig(tile: PrunTile) {
  const config = {} as BluShieldConfig;
  for (const slot of SHIELD_SLOTS) {
    const select = findShieldSelect(tile, slot);
    if (!select) {
      return undefined;
    }
    config[slot] = getShieldSelectValue(select);
  }
  return config;
}

function shieldsMatch(a: BluShieldConfig, b: BluShieldConfig) {
  return SHIELD_SLOTS.every(slot => a[slot] === b[slot]);
}

/** Shields already match preset and blueprint has no unsaved changes. */
export function isBluShieldPresetAlreadyApplied(tile: PrunTile, shields: BluShieldConfig) {
  const current = getCurrentBluShieldConfig(tile);
  if (!current || !shieldsMatch(current, shields)) {
    return false;
  }
  const saveButton = findBluSaveButton(tile);
  if (!saveButton) {
    return false;
  }
  return isBluSaveDisabled(saveButton);
}

export function applyBluShieldConfig(tile: PrunTile, shields: BluShieldConfig) {
  for (const slot of SHIELD_SLOTS) {
    const select = findShieldSelect(tile, slot);
    if (!select) {
      return `Shield row not found: ${shieldLabel(slot)}`;
    }
    if (!setShieldSelect(select, shields[slot])) {
      const want = shields[slot] === '' ? '(empty)' : shields[slot];
      return `Option ${want} not found for ${shieldLabel(slot)}`;
    }
  }
  return undefined;
}

export function findBluSaveButton(tile: PrunTile) {
  const saveLabel = L.Blueprint.action.save();
  return _$$(tile.anchor, C.Button.btn).find(x => x.textContent?.trim() === saveLabel);
}

function isBluSaveDisabled(button: HTMLElement) {
  return (
    button.classList.contains(C.Button.disabled) ||
    button.classList.contains(C.Button.disabledInline) ||
    (button as HTMLButtonElement).disabled
  );
}

/** BLU save has no ActionFeedback overlay — success is Save becoming disabled. */
export async function waitBluSaveComplete(tile: PrunTile) {
  const button = findBluSaveButton(tile);
  if (!button) {
    return 'Save button not found';
  }
  if (isBluSaveDisabled(button)) {
    return undefined;
  }
  await new Promise<void>(resolve => {
    const observer = new MutationObserver(() => {
      if (isBluSaveDisabled(button)) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(button, { attributes: true, attributeFilter: ['class', 'disabled'] });
  });
  return undefined;
}

export async function clickBluSave(tile: PrunTile) {
  const button = findBluSaveButton(tile);
  if (!button) {
    return 'Save button not found';
  }
  if (isBluSaveDisabled(button)) {
    // Already clean — nothing to save.
    return;
  }
  await clickElement(button);
  return undefined;
}
