<script setup lang="ts">
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import Tabs, { Tab } from '@src/components/Tabs.vue';
import GAME from '@src/features/XIT/SET/GAME.vue';
import FEAT from '@src/features/XIT/SET/FEAT.vue';
import FIN from '@src/features/XIT/SET/FIN.vue';
import BFR from '@src/features/XIT/SET/BFR.vue';
import REP from '@src/features/XIT/SET/REP.vue';

const tabs: Tab[] = [
  {
    id: 'GAME',
    label: 'Gameplay',
    component: GAME,
  },
  {
    id: 'REP',
    label: 'Repair',
    component: REP,
  },
  {
    id: 'FEAT',
    label: 'Features',
    component: FEAT,
  },
  {
    id: 'FIN',
    label: 'Financial',
    component: FIN,
  },
  {
    id: 'BFR',
    label: 'Buffers',
    component: BFR,
  },
];

const parameters = useXitParameters();
const parameter = parameters[0];

const activeTab = shallowRef(tabs.find(x => x.id === parameter?.toUpperCase()) ?? tabs[0]);
</script>

<template>
  <Tabs v-model="activeTab" :tabs="tabs" />
</template>
