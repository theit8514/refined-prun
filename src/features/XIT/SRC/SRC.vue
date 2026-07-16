<script setup lang="ts">
import ActionBar from '@src/components/ActionBar.vue';
import Header from '@src/components/Header.vue';
import PrunButton from '@src/components/PrunButton.vue';
import Active from '@src/components/forms/Active.vue';
import ComboboxInput from '@src/components/forms/ComboboxInput.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import LogWindow from '@src/features/XIT/ACT/LogWindow.vue';
import type { LogTag } from '@src/features/XIT/ACT/runner/logger';
import { Logger } from '@src/features/XIT/ACT/runner/logger';
import { SrcRunner } from '@src/features/XIT/SRC/src-runner';
import type { BtfFtlMode } from '@src/features/XIT/SRC/configure-btf';
import { formatAddressTargetLabel } from '@src/features/XIT/SRC/address-target';
import { blueprintsStore } from '@src/infrastructure/prun-api/data/blueprints';
import { planetsStore } from '@src/infrastructure/prun-api/data/planets';
import { stationsStore } from '@src/infrastructure/prun-api/data/stations';
import { useTile } from '@src/hooks/use-tile';
import { useTileState } from '@src/store/user-data-tiles';
import { comparePlanets } from '@src/util';

blueprintsStore.request();

const tile = useTile();
const origin = useTileState('origin', '');
const destination = useTileState('destination', '');
const blueprintNaturalId = useTileState('blueprintNaturalId', '');
const fullInventory = useTileState('fullInventory', true);
const ftlMode = useTileState('ftlMode', 'leastJumps' as BtfFtlMode);
const useGateways = useTileState('useGateways', false);

const ftlModeOptions: { label: string; value: BtfFtlMode }[] = [
  { label: 'Least jumps', value: 'leastJumps' },
  { label: 'Shortest FTL', value: 'shortestFTL' },
];

const addressOptions = computed(() => {
  const stations = (stationsStore.all.value ?? [])
    .map(x => ({
      label: formatAddressTargetLabel(x.naturalId),
      value: x.naturalId,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const planets = (planetsStore.all.value ?? [])
    .map(x => ({
      label: `${x.name} (${x.naturalId})`,
      value: x.naturalId,
    }))
    .sort((a, b) => comparePlanets(a.value, b.value));

  return [...stations, ...planets];
});

const blueprintOptions = computed(() =>
  (blueprintsStore.all.value ?? [])
    .filter(x => x.status === 'VALID')
    .map(x => ({
      label: x.name,
      value: x.naturalId,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);

watch(
  addressOptions,
  options => {
    if (options.length === 0) {
      return;
    }
    const values = new Set(options.map(x => x.value));
    // Clear stale tile state; leave empty until the user picks.
    if (origin.value !== '' && !values.has(origin.value)) {
      origin.value = '';
    }
    if (destination.value !== '' && !values.has(destination.value)) {
      destination.value = '';
    }
  },
  { immediate: true },
);

watch(
  blueprintOptions,
  options => {
    if (options.length === 0) {
      return;
    }
    if (!options.some(x => x.value === blueprintNaturalId.value)) {
      blueprintNaturalId.value = options[0].value;
    }
  },
  { immediate: true },
);

const canCollect = computed(() => {
  const originOk = addressOptions.value.some(x => x.value === origin.value);
  const destinationOk = addressOptions.value.some(x => x.value === destination.value);
  return (
    originOk &&
    destinationOk &&
    blueprintNaturalId.value !== '' &&
    blueprintOptions.value.length > 0
  );
});

const goingToSplit = ref(false);
const logScrolling = ref(true);
const log = ref([] as { tag: LogTag; message: string }[]);
const isRunning = ref(false);
const inputsLocked = computed(() => isRunning.value);
const status = ref<string | undefined>(undefined);
const actReady = ref(false);

const runner = new SrcRunner({
  tile,
  log: new Logger(logMessage),
  onBufferSplit: () => {
    goingToSplit.value = true;
  },
  onStart: () => {
    isRunning.value = true;
  },
  onEnd: () => {
    isRunning.value = false;
    status.value = undefined;
    actReady.value = false;
  },
  onStatusChanged: (title, keepReady) => {
    status.value = title;
    if (!keepReady) {
      actReady.value = false;
    }
  },
  onActReady: () => {
    actReady.value = true;
  },
});

function onCollectClick() {
  if (!canCollect.value || isRunning.value) {
    return;
  }
  logScrolling.value = true;
  clearLog();
  actReady.value = false;
  runner.start({
    origin: origin.value,
    destination: destination.value,
    blueprintNaturalId: blueprintNaturalId.value,
    fullInventory: fullInventory.value,
    ftlMode: ftlMode.value,
    useGateways: useGateways.value,
  });
}

function onCancelClick() {
  actReady.value = false;
  runner.cancel();
}

function onActClick() {
  actReady.value = false;
  runner.act();
}

function onSkipClick() {
  actReady.value = false;
  runner.skip();
}

function logMessage(tag: LogTag, message: string) {
  return log.value.push({ tag, message });
}

function clearLog() {
  log.value.length = 0;
}
</script>

<template>
  <div v-if="goingToSplit" />
  <div v-else :class="$style.root">
    <Header :class="$style.header">SHIP REPAIR CALCULATOR</Header>
    <form :class="$style.form">
      <Active label="Origin">
        <ComboboxInput
          v-model="origin"
          :options="addressOptions"
          :disabled="inputsLocked"
          placeholder="Planet, station, or ID" />
      </Active>
      <Active label="Destination">
        <ComboboxInput
          v-model="destination"
          :options="addressOptions"
          :disabled="inputsLocked"
          placeholder="Planet, station, or ID" />
      </Active>
      <Active label="Blueprint">
        <SelectInput
          v-model="blueprintNaturalId"
          :options="blueprintOptions"
          :disabled="inputsLocked" />
      </Active>
      <Active label="FTL mode">
        <SelectInput v-model="ftlMode" :options="ftlModeOptions" :disabled="inputsLocked" />
      </Active>
      <div :class="[$style.options, inputsLocked && $style.locked]">
        <RadioItem v-model="fullInventory" horizontal>Full Inventory</RadioItem>
        <RadioItem v-model="useGateways" horizontal>Use Gateway</RadioItem>
      </div>
    </form>
    <LogWindow :messages="log" :scrolling="logScrolling" :class="$style.mainWindow" />
    <div :class="$style.status">
      <span>Status: </span>
      <span v-if="status">{{ status }}</span>
      <span v-else>Press Collect to start</span>
    </div>
    <ActionBar :class="$style.actionBar">
      <template v-if="!isRunning">
        <PrunButton
          primary
          :disabled="!canCollect"
          :class="$style.collectButton"
          @click="onCollectClick">
          COLLECT
        </PrunButton>
      </template>
      <template v-else>
        <PrunButton
          danger
          :disabled="!actReady"
          :class="$style.collectButton"
          @click="onCancelClick">
          CANCEL
        </PrunButton>
        <PrunButton primary :disabled="!actReady" @click="onActClick">ACT</PrunButton>
        <PrunButton neutral :disabled="!actReady" @click="onSkipClick">SKIP</PrunButton>
      </template>
    </ActionBar>
  </div>
</template>

<style module>
.root {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.form {
  margin-left: 4px;
  margin-bottom: 4px;
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 4px;
  align-items: center;
}

.locked {
  pointer-events: none;
  opacity: 0.6;
}

.mainWindow {
  flex-grow: 1;
  min-height: 0;
}

.header {
  margin-left: 4px;
}

.status {
  margin-left: 5px;
  margin-top: 5px;
}

.actionBar {
  margin-left: 2px;
  justify-content: flex-start;
  user-select: none;
}

.collectButton {
  width: 68px;
}
</style>
