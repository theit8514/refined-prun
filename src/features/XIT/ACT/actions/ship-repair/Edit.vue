<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';

const { action, pkg } = defineProps<{
  action: UserData.ActionData;
  pkg: UserData.ActionPackageData;
}>();

const materialGroups = computed(() =>
  pkg.groups.filter(x => x.type === 'Ship Repair' && x.name !== undefined).map(x => x.name!),
);

const materialGroup = ref(action.group ?? materialGroups.value[0]);
const groupError = ref(false);

watch(materialGroups, groups => {
  if (materialGroup.value && !groups.includes(materialGroup.value)) {
    materialGroup.value = groups[0];
  }
});

function validate() {
  groupError.value = !materialGroup.value || !materialGroups.value.includes(materialGroup.value);
  return !groupError.value;
}

function save() {
  action.group = materialGroup.value;
}

defineExpose({ validate, save });
</script>

<template>
  <Active
    label="Material Group"
    tooltip="Must be a Ship Repair material group. The ship is taken from that group."
    :error="groupError">
    <SelectInput v-model="materialGroup" :options="materialGroups" />
  </Active>
</template>
