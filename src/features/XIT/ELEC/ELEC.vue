<script setup lang="ts">
import ElectionList from '@src/features/XIT/ELEC/ElectionList.vue';
import RefreshElectionData from '@src/features/XIT/ELEC/RefreshElectionData.vue';
import { useXitParameters } from '@src/hooks/use-xit-parameters';

const parameters = useXitParameters();
const isRefreshMode = computed(() => parameters[0]?.toUpperCase() === 'REFRESH');
</script>

<template>
  <RefreshElectionData v-if="isRefreshMode" />
  <ElectionList v-else />
</template>
