<template>
  <div class="findbar no-drag">
    <span class="fb-ico"><Icon name="search" /></span>
    <input
      ref="inputEl"
      v-model="query"
      class="fb-input"
      placeholder="在便笺中查找…"
      spellcheck="false"
      @input="onInput"
      @keydown.enter.exact.prevent="next"
      @keydown.shift.enter.exact.prevent="prev"
      @keydown.esc.prevent="close"
    />
    <span class="fb-count" :class="{ empty: query && !matches }">{{ countText }}</span>
    <button class="fb-btn" title="上一个（Shift+Enter）" @click="prev"><Icon name="chevron-up" /></button>
    <button class="fb-btn" title="下一个（Enter）" @click="next"><Icon name="chevron-down" /></button>
    <button class="fb-btn" title="关闭（Esc）" @click="close"><Icon name="x" /></button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import Icon from './Icon.vue'

const api = window.api
const emit = defineEmits(['close'])

const inputEl = ref(null)
const query = ref('')
const matches = ref(0)
const active = ref(0)

let timer = null

const countText = computed(() => {
  if (!query.value) return ''
  if (!matches.value) return '无结果'
  return `${active.value || 1}/${matches.value}`
})

function run(forward, findNext) {
  api.findQuery({ text: query.value, forward, findNext })
}
function onInput() {
  clearTimeout(timer)
  timer = setTimeout(() => run(true, false), 120) // 输入防抖，避免每个字符都全量查找
}
function next() { run(true, true) }
function prev() { run(false, true) }
function close() {
  api.findStop()
  emit('close')
}

onMounted(() => {
  nextTick(() => inputEl.value && inputEl.value.focus())
  api.onFindResult((res) => {
    matches.value = res?.matches || 0
    active.value = res?.active || 0
  })
})
onUnmounted(() => clearTimeout(timer))
</script>

<style scoped>
/* MD3 Search bar：全圆角胶囊 + surface-container-high */
.findbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  margin: 8px 12px;
  padding: 0 6px 0 16px;
  background: var(--md-surface-container-high);
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-xl);
  animation: fb-in var(--dur-short) var(--md-ease-emphasized);
}
@keyframes fb-in {
  from { opacity: 0; transform: translateY(-6px); }
}
.fb-ico { color: var(--md-on-surface-variant); display: flex; }
.fb-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--md-on-surface);
  font-size: 14.5px;
}
.fb-input::placeholder { color: var(--md-on-surface-variant); }
.fb-count {
  font-size: 12px;
  color: var(--md-on-surface-variant);
  font-variant-numeric: tabular-nums;
  min-width: 34px;
  text-align: right;
}
.fb-count.empty { color: var(--md-error); }
.fb-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--shape-full);
  background: transparent;
  color: var(--md-on-surface-variant);
  cursor: pointer;
  transition: color var(--dur-short) var(--md-ease-standard), transform var(--dur-short) var(--md-ease-standard);
}
.fb-btn:hover { color: var(--md-primary); }
.fb-btn:active { transform: scale(.92); }
</style>
