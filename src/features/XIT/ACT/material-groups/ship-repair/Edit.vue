<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import {
  getEditShipOptions,
  getRepairLocationOptions,
} from '@src/features/XIT/ACT/material-groups/ship-repair/utils';

const { group } = defineProps<{ group: UserData.MaterialGroupData }>();

const locations = computed(() => getRepairLocationOptions(true));
const location = ref(group.location ?? locations.value[0]);
const locationError = ref(false);

const ships = computed(() => getEditShipOptions());

function firstShipValue() {
  const option = ships.value[0];
  return typeof option === 'string' ? option : option?.value;
}

const ship = ref(group.ship ?? firstShipValue());
const shipError = ref(false);

watch(ships, options => {
  const values = options.map(x => (typeof x === 'string' ? x : x.value));
  if (!ship.value || !values.includes(ship.value)) {
    ship.value = firstShipValue();
  }
});

function validate() {
  locationError.value = !location.value;
  shipError.value = !ship.value;
  return !locationError.value && !shipError.value;
}

function save() {
  group.location = location.value;
  group.ship = ship.value;
}

defineExpose({ validate, save });
</script>

<template>
  <Active label="Location" :error="locationError">
    <SelectInput v-model="location" :options="locations" />
  </Active>
  <Active label="Ship" :error="shipError">
    <SelectInput v-model="ship" :options="ships" />
  </Active>
</template>
