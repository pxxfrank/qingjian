<template>
  <div class="color-picker">
    <button
      v-for="key in colorKeys"
      :key="key"
      class="swatch"
      :data-color="key"
      :style="{ background: noteColors[key].swatch }"
      :title="key"
      @click="$emit('pick', key)"
    ></button>
  </div>
</template>

<script setup>
import { noteColors, noteColorKeys } from '../tokens'
const colorKeys = noteColorKeys
defineEmits(['pick'])
</script>

<style scoped>
/* MD3 Menu：surface-container + 12dp 圆角 + elevation 2 */
.color-picker {
  position: absolute;
  top: 50px; right: 8px;
  display: flex; gap: 8px;
  padding: 10px;
  background: var(--md-surface-container);
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-m);
  box-shadow: var(--elev-2);
  z-index: 200;
  animation: picker-in var(--dur-short) var(--md-ease-emphasized);
}
@keyframes picker-in {
  from { opacity: 0; transform: translateY(-6px) scale(.94); }
}
.swatch {
  width: 26px; height: 26px;
  border: 2px solid transparent;
  border-radius: var(--shape-full);
  cursor: pointer;
  transition: transform var(--dur-short) var(--md-ease-standard), box-shadow var(--dur-short) var(--md-ease-standard);
}
.swatch:hover {
  transform: scale(1.12);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--md-primary) 22%, transparent);
}
.swatch:active { transform: scale(1.02); }
</style>
