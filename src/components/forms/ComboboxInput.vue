<script setup lang="ts">
type Option =
  | string
  | {
      label: string;
      value: string;
    };

const model = defineModel<string>();

const {
  options,
  placeholder = '',
  disabled = false,
} = defineProps<{
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
}>();

const open = ref(false);
const query = ref('');
const highlightIndex = ref(0);
const root = useTemplateRef<HTMLElement>('root');
const input = useTemplateRef<HTMLInputElement>('input');

function optionValue(option: Option) {
  return typeof option === 'string' ? option : option.value;
}

function optionLabel(option: Option) {
  return typeof option === 'string' ? option : option.label;
}

const normalizedOptions = computed(() =>
  options.map(x => ({
    label: optionLabel(x),
    value: optionValue(x),
  })),
);

const selectedOption = computed(() => normalizedOptions.value.find(x => x.value === model.value));

function syncQueryFromModel() {
  query.value = selectedOption.value?.label ?? '';
}

watch(
  [model, normalizedOptions],
  () => {
    if (!open.value) {
      syncQueryFromModel();
    }
  },
  { immediate: true },
);

const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    return normalizedOptions.value;
  }
  return normalizedOptions.value.filter(
    x => x.label.toLowerCase().includes(q) || x.value.toLowerCase().includes(q),
  );
});

watch(filteredOptions, options => {
  highlightIndex.value =
    options.length === 0 ? 0 : Math.min(highlightIndex.value, options.length - 1);
});

function selectOption(option: { label: string; value: string }) {
  model.value = option.value;
  query.value = option.label;
  open.value = false;
  highlightIndex.value = 0;
}

function trySelectExact() {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    return false;
  }
  const exact =
    filteredOptions.value.find(x => x.value.toLowerCase() === q) ??
    filteredOptions.value.find(x => x.label.toLowerCase() === q) ??
    (filteredOptions.value.length === 1 ? filteredOptions.value[0] : undefined);
  if (!exact) {
    return false;
  }
  selectOption(exact);
  return true;
}

function onFocus() {
  if (disabled) {
    return;
  }
  open.value = true;
  highlightIndex.value = 0;
}

function onInput() {
  if (disabled) {
    return;
  }
  open.value = true;
  highlightIndex.value = 0;
  // Clear committed value while typing so Collect stays disabled until a pick.
  if (selectedOption.value && query.value !== selectedOption.value.label) {
    model.value = '';
  }
}

function onBlur(event: FocusEvent) {
  const next = event.relatedTarget as Node | null;
  if (next && root.value?.contains(next)) {
    return;
  }
  if (!trySelectExact()) {
    syncQueryFromModel();
  }
  open.value = false;
}

function onKeydown(event: KeyboardEvent) {
  if (disabled) {
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    open.value = true;
    if (filteredOptions.value.length === 0) {
      return;
    }
    highlightIndex.value = (highlightIndex.value + 1) % filteredOptions.value.length;
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    open.value = true;
    if (filteredOptions.value.length === 0) {
      return;
    }
    highlightIndex.value =
      (highlightIndex.value - 1 + filteredOptions.value.length) % filteredOptions.value.length;
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const highlighted = filteredOptions.value[highlightIndex.value];
    if (open.value && highlighted !== undefined) {
      selectOption(highlighted);
      return;
    }
    trySelectExact();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    syncQueryFromModel();
    open.value = false;
    input.value?.blur();
  }
}

function onSuggestionsMouseDown(event: MouseEvent) {
  // Keep input focus so scrollbar / option clicks don't close the list.
  event.preventDefault();
}

function onOptionMouseDown(event: MouseEvent, option: { label: string; value: string }) {
  event.preventDefault();
  selectOption(option);
}
</script>

<template>
  <div ref="root" :class="$style.container">
    <input
      ref="input"
      v-model="query"
      type="text"
      :placeholder="placeholder"
      :disabled="disabled"
      autocomplete="off"
      data-1p-ignore="true"
      data-lpignore="true"
      :class="$style.input"
      @focus="onFocus"
      @input="onInput"
      @blur="onBlur"
      @keydown="onKeydown" />
    <div
      v-if="open && filteredOptions.length > 0"
      :class="$style.suggestions"
      @mousedown="onSuggestionsMouseDown">
      <button
        v-for="(option, index) in filteredOptions"
        :key="option.value"
        type="button"
        :class="[$style.suggestion, index === highlightIndex && $style.highlighted]"
        @mousedown="onOptionMouseDown($event, option)">
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<style module>
.container {
  position: relative;
  width: 220px;
  margin-right: 0;
  margin-left: auto;
}

.input {
  width: 100%;
  box-sizing: border-box;
}

.input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.suggestions {
  position: absolute;
  z-index: 20;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 180px;
  overflow-y: auto;
  background-color: #21252b;
  border: 1px solid #42454d;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
}

.suggestion {
  display: block;
  width: 100%;
  margin: 0;
  padding: 3px 6px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.suggestion:hover,
.highlighted {
  background-color: #2f353e;
}
</style>
