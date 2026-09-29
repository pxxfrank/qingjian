<template>
  <div class="remind-picker">
    <div class="rp-form">
      <input class="rp-time" type="datetime-local" v-model="when" />
      <select class="rp-repeat" v-model="repeat">
        <option v-for="opt in repeatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <button class="rp-set" :disabled="!when" @click="setRemind">设置</button>
    </div>
    <div v-if="list.length" class="rp-list">
      <div v-for="r in list" :key="r.id" class="rp-item" :class="{ done: r.done }">
        <span class="rp-item-time">{{ fmt(r.at) }}</span>
        <span class="rp-item-repeat">{{ repeatLabel(r.repeat) }}</span>
        <button class="rp-del md-state" title="删除提醒" @click="remove(r.id)"><Icon name="x" /></button>
      </div>
    </div>
    <div v-else class="rp-empty">暂无提醒</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({ noteId: { type: String, required: true } })
const emit = defineEmits(['changed'])

const api = window.api
const when = ref('')
const repeat = ref('once')
const list = ref([])

const repeatOptions = [
  { value: 'once', label: '一次' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'weekdays', label: '工作日' }
]

function pad(n) { return String(n).padStart(2, '0') }

function fmt(at) {
  const d = new Date(at)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function repeatLabel(r) {
  const opt = repeatOptions.find((o) => o.value === r)
  return opt ? opt.label : ''
}

async function load() {
  const arr = await api.remindList(props.noteId)
  list.value = Array.isArray(arr) ? arr : []
}

async function setRemind() {
  if (!when.value) return
  const at = new Date(when.value).getTime() // datetime-local 按本地时区解析
  if (!Number.isFinite(at)) return
  const rem = {
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at,
    repeat: repeat.value,
    anchorText: null,
    done: false,
    lastFired: null
  }
  await api.remindSet(props.noteId, rem)
  when.value = ''
  await load()
  emit('changed')
}

async function remove(remId) {
  await api.remindRemove(props.noteId, remId)
  await load()
  emit('changed')
}

onMounted(load)
</script>

<style scoped>
/* MD3 Menu：surface-container + 12dp 圆角 + elevation 2（与 ColorPicker 同款弹层） */
.remind-picker {
  position: absolute;
  top: 50px; right: 8px;
  width: 268px;
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
.rp-form { display: flex; gap: 6px; align-items: center; }
.rp-time,
.rp-repeat {
  height: 32px;
  box-sizing: border-box;
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-s);
  background: var(--md-surface-container-high);
  color: var(--md-on-surface);
  font: inherit;
  font-size: 12.5px;
  padding: 0 8px;
  outline: none;
}
.rp-time { flex: 1 1 auto; min-width: 0; }
.rp-repeat { flex: 0 0 72px; }
.rp-time:focus,
.rp-repeat:focus { border-color: var(--md-primary); }
/* MD3 Filled tonal button */
.rp-set {
  flex: 0 0 auto;
  height: 32px;
  border: none;
  border-radius: var(--shape-full);
  padding: 0 14px;
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: box-shadow var(--dur-short) var(--md-ease-standard), transform var(--dur-short) var(--md-ease-standard);
}
.rp-set:hover { box-shadow: var(--elev-1); }
.rp-set:active { transform: scale(.96); }
.rp-set:disabled { opacity: .5; cursor: default; box-shadow: none; }

.rp-list {
  margin-top: 8px;
  max-height: 168px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rp-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 4px 5px 8px;
  border-radius: var(--shape-s);
  font-size: 12.5px;
  color: var(--md-on-surface);
}
.rp-item.done { opacity: .5; text-decoration: line-through; }
.rp-item-time { flex: 1 1 auto; min-width: 0; font-variant-numeric: tabular-nums; }
.rp-item-repeat { flex: 0 0 auto; font-size: 11.5px; color: var(--md-on-surface-variant); }
.rp-del {
  flex: 0 0 auto;
  width: 24px; height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--shape-full);
  background: transparent;
  color: var(--md-on-surface-variant);
  cursor: pointer;
  padding: 0;
  transition: color var(--dur-short) var(--md-ease-standard);
}
.rp-del:hover { color: var(--md-error); }
.rp-del svg { width: 15px; height: 15px; }
.rp-empty {
  margin-top: 8px;
  padding: 8px 4px;
  font-size: 12px;
  text-align: center;
  color: var(--md-on-surface-variant);
}
</style>
