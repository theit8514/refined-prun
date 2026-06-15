<script setup lang="ts">
import Passive from '@src/components/forms/Passive.vue';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { isRepairableBuilding } from '@src/core/buildings';

const { siteId, minCondition } = defineProps<{
  siteId?: string | null;
  minCondition?: string | null;
}>();

const site = computed(() => sitesStore.getById(siteId));
const minConditionValue = computed(() => Number(minCondition));

const selectedBuildings = computed(() => {
  if (!site.value || !Number.isFinite(minConditionValue.value)) {
    return [];
  }
  return site.value.platforms.filter(
    x => isRepairableBuilding(x) && x.condition <= minConditionValue.value,
  );
});

const label = computed(() => {
  if (selectedBuildings.value.length === 0) {
    return '--';
  }

  const now = aggregateMaterials('repairMaterials');
  const in24 = aggregateMaterials('repairMaterials24');
  const in48 = aggregateMaterials('repairMaterials48');

  const tickers = new Set([...now.keys(), ...in24.keys(), ...in48.keys()]);
  let risesWithin24 = false;
  let risesWithin48 = false;
  for (const ticker of tickers) {
    const amount = now.get(ticker) ?? 0;
    const amount24 = in24.get(ticker) ?? amount;
    const amount48 = in48.get(ticker) ?? amount24;
    const risesInFirstWindow = amount24 > amount;
    const risesInSecondWindow = amount48 > amount24;

    // Ignore materials that rise in both windows (continuous bulk ramps).
    if (risesInFirstWindow === risesInSecondWindow) {
      continue;
    }

    if (risesInFirstWindow) {
      risesWithin24 = true;
    } else {
      risesWithin48 = true;
    }
  }

  if (risesWithin24) {
    return '<24h';
  }
  if (risesWithin48) {
    return '<48h';
  }
  return '--';
});

function aggregateMaterials(field: 'repairMaterials' | 'repairMaterials24' | 'repairMaterials48') {
  const amounts = new Map<string, number>();
  for (const building of selectedBuildings.value) {
    for (const { material, amount } of building[field]) {
      amounts.set(material.ticker, (amounts.get(material.ticker) ?? 0) + amount);
    }
  }
  return amounts;
}
</script>

<template>
  <Passive
    label="Next breakpoint"
    tooltip="Whether the repair bill crosses a material breakpoint within the next 24h or 48h, ignoring bulk materials that rise in both windows.">
    {{ label }}
  </Passive>
</template>
