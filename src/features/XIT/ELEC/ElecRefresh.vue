<script setup lang="ts">
import LogWindow from '@src/features/XIT/ACT/LogWindow.vue';
import type { LogTag } from '@src/features/XIT/ACT/runner/logger';
import ActionBar from '@src/components/ActionBar.vue';
import Header from '@src/components/Header.vue';
import PrunButton from '@src/components/PrunButton.vue';
import {
  ElecDataRefreshRunner,
  collectElectionRefreshPlanetIds,
} from '@src/features/XIT/ELEC/elec-refresh-runner';
import { useTile } from '@src/hooks/use-tile';

const tile = useTile();

const busy = ref(false);
const logScrolling = ref(true);
const logMessages = ref<Array<{ tag: LogTag; message: string }>>([]);

function appendLogTagged(tag: LogTag, body: string) {
  logMessages.value.push({ tag, message: body });
}

function clearLog() {
  logMessages.value = [];
}

/** Same timing as ACT’s `ExecuteActionPackage` → `new ActionRunner` → `TileAllocator` splits solo buffers on load. */
const runner = new ElecDataRefreshRunner(tile, {
  onBufferSplit: () => {
    appendLogTagged(
      'WARNING',
      'Split buffer — companion tile on the right loads each ADM / COGC step.',
    );
  },
  onLog: appendLogTagged,
  onBusyChange: v => {
    busy.value = v;
  },
});

/** Bumped when `ElecDataRefreshRunner` internal queue state changes (`runner` is not reactive). */
const queueRevision = ref(0);

function touchQueueRevision() {
  queueRevision.value++;
}

const planetIds = computed(() => collectElectionRefreshPlanetIds());

const queued = computed(() => {
  void queueRevision.value;
  return runner.hasNext;
});
const awaitingInitialPrepare = computed(() => {
  void queueRevision.value;
  return runner.isAwaitingInitialPrepare;
});

const status = computed(() => {
  void queueRevision.value;
  void busy.value;
  if (busy.value) {
    return 'Opening companion tile…';
  }
  if (planetIds.value.length === 0) {
    return 'No bases — cannot build a planet queue.';
  }
  if (awaitingInitialPrepare.value) {
    return undefined;
  }
  if (runner.hasNext) {
    const peek = runner.peekNext()!;
    return `Next step: ${peek.kind} ${peek.planetNaturalId} (${runner.completedCount}/${runner.totalSteps})`;
  }
  if (runner.totalSteps > 0 && runner.completedCount >= runner.totalSteps && !runner.isPrepared) {
    return 'Refresh complete — open XIT ELEC for results.';
  }
  return undefined;
});

function prepareQueue() {
  if (busy.value || planetIds.value.length === 0) {
    return;
  }
  clearLog();
  runner.prepare(planetIds.value);
  touchQueueRevision();
}

async function nextStep() {
  if (!runner.hasNext || busy.value) {
    return;
  }
  try {
    await runner.advance();
  } finally {
    touchQueueRevision();
  }
}

function resetQueue() {
  if (busy.value) {
    return;
  }
  runner.reset();
  touchQueueRevision();
}
</script>

<template>
  <div :class="$style.root">
    <Header :class="$style.header">REFRESH ELECTION DATA</Header>
    <LogWindow :messages="logMessages" :scrolling="logScrolling" :class="$style.mainWindow" />
    <div :class="$style.status">
      <span>Status: </span>
      <span v-if="status !== undefined">{{ status }}</span>
      <span v-else>Press Prepare to queue tiles</span>
    </div>
    <ActionBar :class="$style.actionBar">
      <PrunButton primary :disabled="busy || planetIds.length === 0" @click="prepareQueue">
        Prepare
      </PrunButton>
      <PrunButton primary :disabled="!queued || busy" @click="nextStep"> Next step </PrunButton>
      <PrunButton dark :disabled="busy" @click="resetQueue"> Reset </PrunButton>
    </ActionBar>
  </div>
</template>

<style module>
/* Match `ExecuteActionPackage`: fill the tile, then let header / status / actions size naturally — only `mainWindow` grows. */
.root {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
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
</style>
