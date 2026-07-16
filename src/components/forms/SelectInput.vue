<script setup lang="ts">
const model = defineModel<string>();

type Option =
  | string
  | {
      label: string;
      value: string;
    };

const { disabled = false } = defineProps<{ options: Option[]; disabled?: boolean }>();

const value = (option: Option) => (typeof option === 'string' ? option : option.value);
const label = (option: Option) => (typeof option === 'string' ? option : option.label);
</script>

<template>
  <div :class="$style.container">
    <select v-model="model" :disabled="disabled" :class="$style.select">
      <option v-for="option in options" :key="value(option)" :value="value(option)">
        {{ label(option) }}
      </option>
    </select>
  </div>
</template>

<style module>
.container {
  width: 158px;
  margin-right: 0;
  margin-left: auto;
}

.select {
  width: 100%;
}
</style>
