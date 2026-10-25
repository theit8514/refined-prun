<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import { Config } from '@src/features/XIT/ACT/material-groups/ship-repair/config';
import { configurableValue } from '@src/features/XIT/ACT/shared-types';
import {
  formatShipOption,
  getRepairLocationOptions,
  getShipsAtLocation,
} from '@src/features/XIT/ACT/material-groups/ship-repair/utils';

const { data, config } = defineProps<{ data: UserData.MaterialGroupData; config: Config }>();

const locationOptions = computed(() => getRepairLocationOptions(false));

if (data.location === configurableValue && !config.location && locationOptions.value.length > 0) {
  config.location = locationOptions.value[0];
}

const effectiveLocation = computed(() =>
  data.location === configurableValue ? config.location : data.location,
);

const shipsAtLocation = computed(() => getShipsAtLocation(effectiveLocation.value));

const shipOptions = computed(() => {
  const options = shipsAtLocation.value.map(formatShipOption);
  if (options.length === 0) {
    options.push({ label: 'No ships available', value: undefined! });
  }
  return options;
});

if (data.ship === configurableValue && !config.ship && shipsAtLocation.value.length > 0) {
  config.ship = shipsAtLocation.value[0].registration;
}

watchEffect(() => {
  if (data.location === configurableValue) {
    if (config.location && !locationOptions.value.includes(config.location)) {
      config.location = undefined;
    }
    if (!config.location && locationOptions.value.length === 1) {
      config.location = locationOptions.value[0];
    }
  }

  if (data.ship === configurableValue) {
    const registrations = shipsAtLocation.value.map(x => x.registration);
    if (config.ship && !registrations.includes(config.ship)) {
      config.ship = undefined;
    }
    if (!config.ship && shipsAtLocation.value.length === 1) {
      config.ship = shipsAtLocation.value[0].registration;
    }
  }
});
</script>

<template>
  <form>
    <Active v-if="data.location === configurableValue" label="Location">
      <SelectInput v-model="config.location" :options="locationOptions" />
    </Active>
    <Active v-if="data.ship === configurableValue" label="Ship">
      <SelectInput v-model="config.ship" :options="shipOptions" />
    </Active>
  </form>
</template>
