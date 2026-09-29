<template>
  <div
    class="launcher"
    :data-edge="edge"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <!-- 收起：半个小球（渐变球体；可拖到左右边缘；捕获便笺时播放涟漪） -->
    <div v-if="!expanded" class="ball" title="速记坞（拖动可上下移动、左右换边）">
      <span ref="coreEl" class="ball-core">❈</span>
      <span
        v-if="ripple"
        :key="ripple.key"
        class="ripple"
        :style="{ color: ripple.color }"
      ></span>
    </div>

    <!-- 展开：扁长横条（列表 + 被收起的便笺 + 新建） -->
    <div v-else class="bar">
      <button class="ico md-state list" title="便笺列表" @pointerdown.stop @click="openList">
        <Icon name="list" />
      </button>
      <button
        v-for="n in items.notes"
        :key="n.id"
        class="ico md-state note"
        :title="n.title || '无标题'"
        @pointerdown.stop
        @click="openNote(n.id)"
      >
        <span class="dot" :style="{ background: dotColor(n.color) }"></span>
      </button>
      <button class="ico md-state new" title="新建便笺" @pointerdown.stop @click="createNote">
        <Icon name="plus" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { noteColors } from '../src/tokens'
import { applyTheme, setSystemDark } from '../src/theme'
import Icon from '../src/components/Icon.vue'

const api = window.api
const expanded = ref(false)
const edge = ref('right')
const items = ref({ notes: [], list: false })
const ripple = ref(null)
const coreEl = ref(null)

let dragging = false
let rippleKey = 0
let catchTimer = null

function dotColor(c) {
  return (noteColors[c] || noteColors.yellow).swatch
}

async function refreshItems() {
  items.value = await api.getLauncherItems()
}

function openList() {
  api.openList()
}
function openNote(id) {
  api.openNote(id)
}
async function createNote() {
  await api.launcherCreateNote()
}

// 小球「捕获」反馈：涟漪扩散 + 球体弹跳，颜色取自被收起的便笺
function playCatch(pulse) {
  const color = pulse && noteColors[pulse.color] ? noteColors[pulse.color].swatch : null
  ripple.value = { key: ++rippleKey, color: color || 'var(--accent)' }
  const el = coreEl.value
  if (el) {
    el.classList.remove('catch')
    void el.offsetWidth
    el.classList.add('catch')
  }
  clearTimeout(catchTimer)
  catchTimer = setTimeout(() => { ripple.value = null }, 850)
}

// ---------- 纵向拖动（记忆位置） ----------
function onDown(e) {
  if (e.button !== 0) return
  e.preventDefault()
  dragging = true
  e.currentTarget.setPointerCapture(e.pointerId)
  api.launcherDragStart(e.screenX, e.screenY)
}
function onMove(e) {
  if (!dragging) return
  api.launcherDragMove(e.screenX, e.screenY)
}
function onUp(e) {
  if (!dragging) return
  dragging = false
  try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  api.launcherDragEnd()
}

onMounted(async () => {
  const settings = await api.getSettings()
  edge.value = settings.launcher === 'left' ? 'left' : 'right'
  applyTheme(settings.theme || 'system')
  api.onThemeChanged((t) => applyTheme(t))
  api.onSystemDark((dark) => { setSystemDark(dark); applyTheme(settings.theme || 'system') })
  api.onLauncherItems((it) => { items.value = it || { notes: [], list: false } })
  api.onLauncherPulse(playCatch)
  api.onLauncherState((st) => {
    if (typeof st.expanded === 'boolean') expanded.value = st.expanded
    if (st.edge === 'left' || st.edge === 'right') edge.value = st.edge
  })
  const cur = await api.getLauncher()
  if (cur) {
    if (typeof cur.expanded === 'boolean') expanded.value = cur.expanded
    if (cur.edge === 'left' || cur.edge === 'right') edge.value = cur.edge
  }
  await refreshItems()
})
onUnmounted(() => clearTimeout(catchTimer))
</script>

<style scoped>
.launcher {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

/* ---------- 收起：小球 = MD3 FAB ----------
   窗口为 2R×2R（76×76），球体 40dp 居中；一半在屏外 → 露出半圆。
   球壳 .ball 负责布局/拖拽命中，.ball-core 负责视觉与捕获弹跳：
   弹跳走独立 scale 属性，与悬停的 transform 缩放互不干扰。 */
.ball {
  position: relative;
  width: 40px;
  height: 40px;
  cursor: grab;
}
.ball:active { cursor: grabbing; }

/* MD3 FAB：primary-container 容器色 + elevation 3 */
.ball-core {
  position: absolute;
  inset: 0;
  border-radius: var(--shape-l);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md-on-primary-container);
  font-size: 18px;
  line-height: 1;
  background: var(--md-primary-container);
  box-shadow: var(--elev-3);
  opacity: .92;
  transition: opacity var(--dur-short) var(--md-ease-standard),
    transform var(--dur-short) var(--md-ease-standard),
    box-shadow var(--dur-short) var(--md-ease-standard);
}
.ball:hover .ball-core {
  opacity: 1;
  transform: scale(1.1);
  box-shadow: var(--elev-3), 0 0 0 4px color-mix(in srgb, var(--md-primary) 14%, transparent);
}
.ball:active .ball-core { transform: scale(.94); }

/* 捕获弹跳：吞下便笺瞬间的挤压伸展 */
.ball-core.catch { animation: catch-pop .55s var(--md-ease-emphasized); }
@keyframes catch-pop {
  0% { scale: 1.08; }
  35% { scale: 1.24; }
  65% { scale: .9; }
  100% { scale: 1; }
}

/* 捕获涟漪：以球心向外扩散消散 */
.ripple {
  position: absolute;
  inset: -2px;
  border-radius: var(--shape-xl);
  border: 2px solid currentColor;
  pointer-events: none;
  animation: ripple .7s var(--md-ease-emphasized) forwards;
}
@keyframes ripple {
  from { transform: scale(.6); opacity: .9; }
  to { transform: scale(1.6); opacity: 0; }
}

/* ---------- 展开：扁长横条（毛玻璃，四角同圆） ---------- */
.bar {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  background: var(--md-surface-container);
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-xl);
  box-shadow: var(--elev-2);
  overflow-x: auto;
  overflow-y: hidden;
  cursor: grab;
  animation: bar-in var(--dur-medium) var(--md-ease-emphasized);
}
@keyframes bar-in {
  from { opacity: .4; transform: scaleX(.86); }
}
.bar:active { cursor: grabbing; }
.bar::-webkit-scrollbar { height: 0; }

/* MD3 Standard icon button（40dp 圆形 + state layer） */
.ico {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--shape-full);
  background: transparent;
  color: var(--md-on-surface-variant);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--dur-short) var(--md-ease-standard), transform var(--dur-short) var(--md-ease-standard);
}
.ico:hover { color: var(--md-primary); }
.ico:active { transform: scale(.9); }
/* 新建：MD3 Filled icon button */
.ico.new {
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
}
.ico.new:hover { color: var(--md-on-primary-container); }
.dot {
  width: 14px;
  height: 14px;
  border-radius: var(--shape-full);
  transition: transform var(--dur-short) var(--md-ease-standard);
}
.ico.note:hover .dot { transform: scale(1.12); }
</style>
