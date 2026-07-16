import {
  applyBluShieldConfig,
  BLU_SHIELD_PRESETS,
  BluShieldPreset,
  clickBluSave,
  isBluShieldPresetAlreadyApplied,
  waitBluSaveComplete,
} from '@src/features/XIT/SRC/configure-blu';
import {
  applyBtfDestination,
  applyBtfFuelUsage,
  applyBtfOrigin,
  BTF_FUEL_PRESETS,
  BtfFuelPreset,
  disableBtfUseGateways,
  runAndWaitMissionPlanUpdate,
  waitForFuelUsageSlider,
} from '@src/features/XIT/SRC/configure-btf';
import { formatAddressTargetLabel } from '@src/features/XIT/SRC/address-target';
import { blueprintsStore } from '@src/infrastructure/prun-api/data/blueprints';
import { Logger } from '@src/features/XIT/ACT/runner/logger';

export interface SrcInputs {
  origin: string;
  destination: string;
  blueprintNaturalId: string;
}

export interface SrcStepContext {
  log: Logger;
  setStatus: (status: string) => void;
  waitAct: (status?: string) => Promise<void>;
  requestTile: (command: string) => Promise<PrunTile | undefined>;
  complete: () => void;
  skip: () => void;
  fail: (message?: string) => void;
}

export interface SrcStep {
  type: string;
  description: string;
  execute: (ctx: SrcStepContext) => Promise<void>;
}

function blueprintLabel(naturalId: string) {
  const blueprint = blueprintsStore.getByNaturalId(naturalId);
  return blueprint ? `${blueprint.name} (${blueprint.naturalId})` : naturalId;
}

async function ensureBtfTile(ctx: SrcStepContext, blueprintNaturalId: string) {
  const { requestTile, setStatus } = ctx;
  const tile = await requestTile(`BTF ${blueprintNaturalId}`);
  if (!tile) {
    return undefined;
  }
  setStatus('Waiting for BTF form…');
  await $(tile.anchor, C.AddressSelector.container);
  return tile;
}

function configureBluStep(blueprintNaturalId: string, preset: BluShieldPreset): SrcStep {
  return {
    type: 'CONFIGURE_BLU',
    description: `Configure BLU shields: ${preset.label}`,
    execute: async ctx => {
      const { setStatus, waitAct, requestTile, complete, skip, fail } = ctx;
      const tile = await requestTile(`BLU ${blueprintNaturalId}`);
      if (!tile) {
        return;
      }

      // Wait until the blueprint form is fully mounted before mutating selects.
      setStatus('Waiting for blueprint form…');
      await $(tile.anchor, C.Blueprint.form);

      if (isBluShieldPresetAlreadyApplied(tile, preset.shields)) {
        skip();
        return;
      }

      setStatus(`Setting shields: ${preset.label}`);
      const applyError = applyBluShieldConfig(tile, preset.shields);
      if (applyError) {
        fail(applyError);
        return;
      }

      await waitAct(`Save blueprint (${preset.label})`);
      setStatus('Saving blueprint…');
      const saveError = await clickBluSave(tile);
      if (saveError) {
        fail(saveError);
        return;
      }
      const waitError = await waitBluSaveComplete(tile);
      if (waitError) {
        fail(waitError);
        return;
      }
      complete();
    },
  };
}

function openBtfStep(blueprintNaturalId: string, preset: BluShieldPreset): SrcStep {
  return {
    type: 'OPEN_BTF',
    description: `Open BTF for ${preset.label}`,
    execute: async ctx => {
      const tile = await ensureBtfTile(ctx, blueprintNaturalId);
      if (!tile) {
        return;
      }
      ctx.complete();
    },
  };
}

function setBtfOriginStep(inputs: SrcInputs, shield: BluShieldPreset): SrcStep {
  const { blueprintNaturalId, origin } = inputs;
  return {
    type: 'SET_BTF_ORIGIN',
    description: `BTF ${shield.label}: set origin`,
    execute: async ctx => {
      const { setStatus, waitAct, complete, fail } = ctx;
      const tile = await ensureBtfTile(ctx, blueprintNaturalId);
      if (!tile) {
        return;
      }

      await waitAct(`Set origin (${formatAddressTargetLabel(origin)})`);
      setStatus('Searching for origin…');
      const error = await applyBtfOrigin(tile, origin);
      if (error) {
        fail(error);
        return;
      }
      complete();
    },
  };
}

function setBtfDestinationStep(inputs: SrcInputs, shield: BluShieldPreset): SrcStep {
  const { blueprintNaturalId, destination } = inputs;
  return {
    type: 'SET_BTF_DESTINATION',
    description: `BTF ${shield.label}: set destination`,
    execute: async ctx => {
      const { setStatus, waitAct, complete, fail } = ctx;
      const tile = await ensureBtfTile(ctx, blueprintNaturalId);
      if (!tile) {
        return;
      }

      await waitAct(`Set destination (${formatAddressTargetLabel(destination)})`);
      setStatus('Searching for destination…');
      const error = await applyBtfDestination(tile, destination);
      if (error) {
        fail(error);
        return;
      }

      setStatus('Waiting for fuel usage slider…');
      const sliderError = await waitForFuelUsageSlider(tile);
      if (sliderError) {
        fail(sliderError);
        return;
      }
      complete();
    },
  };
}

function disableBtfGatewaysStep(inputs: SrcInputs, shield: BluShieldPreset): SrcStep {
  const { blueprintNaturalId } = inputs;
  return {
    type: 'DISABLE_BTF_GATEWAYS',
    description: `BTF ${shield.label}: disable Use gateways`,
    execute: async ctx => {
      const { setStatus, waitAct, complete, skip, fail } = ctx;
      const tile = await ensureBtfTile(ctx, blueprintNaturalId);
      if (!tile) {
        return;
      }

      await waitAct('Disable Use gateways');
      setStatus('Disabling Use gateways…');
      let clicked = false;
      const waitError = await runAndWaitMissionPlanUpdate(tile, async () => {
        const result = await disableBtfUseGateways(tile);
        if (result.error) {
          return result.error;
        }
        clicked = result.clicked;
        return { skipWait: !result.clicked };
      });
      if (waitError) {
        fail(waitError);
        return;
      }
      if (clicked) {
        complete();
      } else {
        skip();
      }
    },
  };
}

function configureBtfFuelStep(
  inputs: SrcInputs,
  shield: BluShieldPreset,
  fuel: BtfFuelPreset,
): SrcStep {
  const { blueprintNaturalId } = inputs;
  return {
    type: 'CONFIGURE_BTF',
    description: `BTF ${shield.label}: ${fuel.label}`,
    execute: async ctx => {
      const { setStatus, waitAct, complete, fail } = ctx;
      const tile = await ensureBtfTile(ctx, blueprintNaturalId);
      if (!tile) {
        return;
      }

      await waitAct(`Set ${fuel.label}`);
      setStatus(`Setting ${fuel.label}…`);
      const waitError = await runAndWaitMissionPlanUpdate(tile, async () =>
        applyBtfFuelUsage(tile, fuel.percent),
      );
      if (waitError) {
        fail(waitError);
        return;
      }
      complete();
    },
  };
}

export function buildSrcSteps(inputs: SrcInputs): SrcStep[] {
  const { origin, destination, blueprintNaturalId } = inputs;
  const steps: SrcStep[] = [
    {
      type: 'ENSURE_BLUEPRINTS',
      description: `${formatAddressTargetLabel(origin)} → ${formatAddressTargetLabel(destination)}`,
      execute: async ctx => {
        const { setStatus, complete, fail } = ctx;
        setStatus('Loading blueprints…');
        if (!blueprintsStore.fetched.value) {
          blueprintsStore.request();
        }
        const blueprint = blueprintsStore.getByNaturalId(blueprintNaturalId);
        if (!blueprint) {
          fail(`Blueprint ${blueprintNaturalId} not found`);
          return;
        }
        if (blueprint.status !== 'VALID') {
          fail(`Blueprint ${blueprintLabel(blueprintNaturalId)} is not VALID`);
          return;
        }
        complete();
      },
    },
    {
      type: 'OPEN_BLU',
      description: `Open BLU ${blueprintNaturalId}`,
      execute: async ctx => {
        const { requestTile, setStatus, complete } = ctx;
        const tile = await requestTile(`BLU ${blueprintNaturalId}`);
        if (!tile) {
          return;
        }
        setStatus('Waiting for blueprint form…');
        await $(tile.anchor, C.Blueprint.form);
        complete();
      },
    },
  ];

  for (const shield of BLU_SHIELD_PRESETS) {
    steps.push(configureBluStep(blueprintNaturalId, shield));
    steps.push(openBtfStep(blueprintNaturalId, shield));
    steps.push(setBtfOriginStep(inputs, shield));
    steps.push(setBtfDestinationStep(inputs, shield));
    steps.push(disableBtfGatewaysStep(inputs, shield));
    for (const fuel of BTF_FUEL_PRESETS) {
      steps.push(configureBtfFuelStep(inputs, shield, fuel));
    }
  }

  return steps;
}
