<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import {
  getEntityNaturalIdFromAddress,
  isSameAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { screensStore } from '@src/infrastructure/prun-api/data/screens';
import { setScreenLocationVariable } from '@src/infrastructure/prun-ui/address-selector';
import $style from './SetLocationVariableButton.module.css';

const { address } = defineProps<{
  address?: PrunApi.Address | null;
}>();

const variables = screensStore.currentLocationVariables;
const naturalId = computed(() => getEntityNaturalIdFromAddress(address));
const busy = ref(false);
const menuOpen = ref(false);

const visible = computed(() => variables.value.length > 0 && !!naturalId.value);

const singleVariable = computed(() =>
  variables.value.length === 1 ? variables.value[0] : undefined,
);

function isCurrentValue(variable: PrunApi.ScreenVariable) {
  return (
    typeof variable.value === 'object' &&
    variable.value !== null &&
    'lines' in variable.value &&
    isSameAddress(address, variable.value)
  );
}

const singleDisabled = computed(() => {
  const variable = singleVariable.value;
  return busy.value || !variable || isCurrentValue(variable);
});

async function applyVariable(name: string) {
  if (!naturalId.value || busy.value) {
    return;
  }
  busy.value = true;
  menuOpen.value = false;
  try {
    const error = await setScreenLocationVariable(name, naturalId.value);
    if (error) {
      console.warn(error);
    }
  } finally {
    busy.value = false;
  }
}

function onSingleClick() {
  const variable = singleVariable.value;
  if (!variable || isCurrentValue(variable)) {
    return;
  }
  void applyVariable(variable.name);
}

function onMenuToggle() {
  if (busy.value) {
    return;
  }
  menuOpen.value = !menuOpen.value;
}

function onMenuItemClick(variable: PrunApi.ScreenVariable) {
  if (isCurrentValue(variable)) {
    return;
  }
  void applyVariable(variable.name);
}
</script>

<template>
  <span v-if="visible" :class="$style.container">
    <PrunButton
      v-if="singleVariable"
      dark
      inline
      :disabled="singleDisabled"
      :data-tooltip="`Set ${singleVariable.name} to this location`"
      data-tooltip-position="top"
      @click="onSingleClick">
      {{ singleVariable.name }}
    </PrunButton>
    <template v-else>
      <PrunButton
        dark
        inline
        :disabled="busy"
        data-tooltip="Set a location screen variable"
        data-tooltip-position="top"
        @click="onMenuToggle">
        Set…
      </PrunButton>
      <span v-if="menuOpen" :class="$style.menu">
        <PrunButton
          v-for="variable in variables"
          :key="variable.id"
          dark
          inline
          :disabled="busy || isCurrentValue(variable)"
          :data-tooltip="`Set ${variable.name} to this location`"
          data-tooltip-position="top"
          @click="onMenuItemClick(variable)">
          {{ variable.name }}
        </PrunButton>
      </span>
    </template>
  </span>
</template>
