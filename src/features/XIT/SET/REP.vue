<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import SectionHeader from '@src/components/SectionHeader.vue';
import Tooltip from '@src/components/Tooltip.vue';
import Active from '@src/components/forms/Active.vue';
import NumberInput from '@src/components/forms/NumberInput.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { getEntityNameFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { userData } from '@src/store/user-data';
import { comparePlanets } from '@src/util';
import { objectId } from '@src/utils/object-id';

const overrides = computed(() => userData.settings.repair.overrides);

const overriddenPlanets = computed(() => new Set(overrides.value.map(x => x.planet)));

const availablePlanets = computed(() => {
  return (sitesStore.all.value ?? [])
    .map(x => getEntityNameFromAddress(x.address))
    .filter((x): x is string => x !== undefined && !overriddenPlanets.value.has(x))
    .sort(comparePlanets);
});

const selectedPlanet = ref(availablePlanets.value[0]);

watch(availablePlanets, planets => {
  if (selectedPlanet.value === undefined || !planets.includes(selectedPlanet.value)) {
    selectedPlanet.value = planets[0];
  }
});

function addOverride() {
  const planet = selectedPlanet.value;
  if (planet === undefined) {
    return;
  }
  overrides.value.push({ planet });
}

function deleteOverride(index: number) {
  overrides.value.splice(index, 1);
}
</script>

<template>
  <SectionHeader>Per-Base Overrides</SectionHeader>
  <form v-if="availablePlanets.length > 0">
    <Active label="Base">
      <div :class="$style.addRow">
        <SelectInput v-model="selectedPlanet" :options="availablePlanets" />
        <PrunButton primary @click="addOverride">ADD</PrunButton>
      </div>
    </Active>
  </form>
  <table>
    <thead>
      <tr>
        <th>Base</th>
        <th>
          Age Threshold
          <Tooltip :class="$style.tooltip" tooltip="Leave blank to use the default from XIT REP." />
        </th>
        <th>
          Time Offset
          <Tooltip :class="$style.tooltip" tooltip="Leave blank to use the default from XIT REP." />
        </th>
        <th />
      </tr>
    </thead>
    <tbody>
      <tr v-if="overrides.length === 0">
        <td>No overrides.</td>
      </tr>
      <template v-else>
        <tr v-for="(override, i) in overrides" :key="objectId(override)">
          <td>{{ override.planet }}</td>
          <td>
            <div :class="C.forms.input">
              <NumberInput v-model="override.threshold" optional />
            </div>
          </td>
          <td>
            <div :class="C.forms.input">
              <NumberInput v-model="override.offset" optional />
            </div>
          </td>
          <td>
            <PrunButton danger @click="deleteOverride(i)">DELETE</PrunButton>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>

<style module>
.addRow {
  display: flex;
  justify-content: flex-end;
  column-gap: 10px;
}

.tooltip {
  float: revert;
}
</style>
