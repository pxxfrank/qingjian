<template>
  <div class="list-app">
    <header class="head drag">
      <div class="brand">
        <span class="brand-mark" :class="{ trash: view === 'trash' }">{{ view === 'trash' ? '♻' : '❈' }}</span>
        {{ view === 'trash' ? '回收站' : '轻笺' }}
      </div>
      <div class="actions no-drag">
        <button
          class="hbtn md-state"
          :class="{ on: view === 'trash' }"
          :title="view === 'trash' ? '返回便笺列表' : (trashCount ? `回收站（${trashCount}）` : '回收站')"
          @click="toggleView"
        >
          <Icon :name="view === 'trash' ? 'list' : 'history'" />
        </button>
        <button class="hbtn md-state" id="dockBtn" title="收起到贴边" @click="hideToDock"><Icon name="collapse" /></button>
        <button class="hbtn md-state" id="themeBtn" :title="'主题：' + themePref" @click="cycleTheme"><Icon :name="themeIcon" /></button>
        <button v-if="view === 'notes'" class="hbtn md-state primary" id="newBtn" title="新建便笺" @click="createNote"><Icon name="plus" /></button>
        <button class="hbtn md-state" id="minBtn" title="最小化" @click="minimizeWin"><Icon name="minus" /></button>
        <button class="hbtn md-state close" id="closeBtn" title="关闭到托盘" @click="closeWin"><Icon name="x" /></button>
      </div>
    </header>

    <div class="search no-drag">
      <span class="search-ico"><Icon name="search" /></span>
      <input v-model="query" id="searchInput" class="search-input" placeholder="搜索便笺…" spellcheck="false" />
      <button v-if="query" class="search-clear" title="清空" @click="query = ''"><Icon name="x" /></button>
    </div>

    <!-- 便笺列表 -->
    <main v-if="view === 'notes'" id="noteGrid" class="grid">
      <NoteCard v-for="(n, i) in filtered" :key="n.id" :note="n" :index="i" @open="openNote" @delete="delNote" />
      <div v-if="!filtered.length" class="empty">
        <span class="leaf">❈</span>
        <span>{{ notes.length ? '没有匹配的便笺' : '还没有便笺，点击右上角 ＋ 新建' }}</span>
      </div>
    </main>

    <!-- 回收站 -->
    <main v-else id="trashGrid" class="grid">
      <div v-if="trash.length" class="trash-bar no-drag">
        <span class="trash-hint">删除的便笺会保留 30 天</span>
        <button class="trash-empty" @click="emptyAll">{{ emptyConfirm ? '确认清空?' : '清空回收站' }}</button>
      </div>
      <div v-for="t in filteredTrash" :key="t.id" class="trash-card">
        <span class="color-dot" :style="{ background: swatchOf(t.color) }"></span>
        <div class="trash-body">
          <div class="trash-title">{{ t.title || '无标题' }}</div>
          <div class="trash-preview">{{ t.preview || '' }}</div>
          <div class="trash-time">删除于 {{ timeAgo(t.deletedAt) }}</div>
        </div>
        <div class="trash-acts no-drag">
          <button class="t-act" title="恢复" @click="restore(t.id)"><Icon name="undo" /></button>
          <button
            class="t-act danger"
            :class="{ confirm: purgeConfirm === t.id }"
            :title="purgeConfirm === t.id ? '再点一次彻底删除' : '彻底删除'"
            @click="purge(t.id)"
          >
            <span v-if="purgeConfirm === t.id">确认</span>
            <Icon v-else name="delete-forever" />
          </button>
        </div>
      </div>
      <div v-if="!filteredTrash.length" class="empty">
        <span class="leaf">♻</span>
        <span>{{ trash.length ? '没有匹配的记录' : '回收站是空的' }}</span>
      </div>
    </main>

    <footer>
      {{ view === 'trash'
        ? '恢复后的便笺会回到列表顶部'
        : '拖动顶部可移动窗口 · 删除的便笺可在回收站找回' }}
    </footer>

    <div
      v-for="d in dirs"
      :key="d"
      :class="['rz', 'rz-' + d]"
      :data-dir="d"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import NoteCard from '../src/components/NoteCard.vue'
import Icon from '../src/components/Icon.vue'
import { noteColors } from '../src/tokens'
import { applyTheme, setSystemDark } from '../src/theme'

const api = window.api
const notes = ref([])
const trash = ref([])
const query = ref('')
const themePref = ref('system')
const view = ref('notes')
const emptyConfirm = ref(false)
const purgeConfirm = ref('')

let emptyTimer = null
let purgeTimer = null

const trashCount = computed(() => trash.value.length)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return notes.value
  return notes.value.filter((n) => (n.title + ' ' + n.preview).toLowerCase().includes(q))
})

const filteredTrash = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return trash.value
  return trash.value.filter((t) => (t.title + ' ' + t.preview).toLowerCase().includes(q))
})

const themeIcons = { system: 'contrast', white: 'square', light: 'sun', dark: 'moon' }
const themeIcon = computed(() => themeIcons[themePref.value] || 'contrast')

function swatchOf(c) {
  return (noteColors[c] || noteColors.yellow).swatch
}

async function refresh() {
  notes.value = await api.listNotes()
}

async function refreshTrash() {
  trash.value = await api.listTrash()
}

async function toggleView() {
  view.value = view.value === 'trash' ? 'notes' : 'trash'
  if (view.value === 'trash') await refreshTrash()
  else await refresh()
}

function cycleTheme() {
  const order = ['system', 'white', 'light', 'dark']
  themePref.value = order[(order.indexOf(themePref.value) + 1) % order.length]
  applyTheme(themePref.value)
  api.setSetting({ theme: themePref.value })
}

async function createNote() {
  const id = await api.createNote()
  api.openNote(id)
}

function openNote(id) {
  api.openNote(id)
}

function hideToDock() {
  api.hideToDock()
}

function minimizeWin() {
  api.minimize()
}

function closeWin() {
  api.closeWindow()
}

async function delNote(id) {
  await api.deleteNote(id)
  await refresh()
  await refreshTrash()
}

async function restore(id) {
  await api.restoreTrash(id)
  await refreshTrash()
  await refresh()
}

async function purge(id) {
  if (purgeConfirm.value !== id) {
    purgeConfirm.value = id
    clearTimeout(purgeTimer)
    purgeTimer = setTimeout(() => { purgeConfirm.value = '' }, 3000)
    return
  }
  clearTimeout(purgeTimer)
  purgeConfirm.value = ''
  await api.purgeTrash(id)
  await refreshTrash()
}

async function emptyAll() {
  if (!emptyConfirm.value) {
    emptyConfirm.value = true
    clearTimeout(emptyTimer)
    emptyTimer = setTimeout(() => { emptyConfirm.value = false }, 3000)
    return
  }
  clearTimeout(emptyTimer)
  emptyConfirm.value = false
  await api.emptyTrash()
  await refreshTrash()
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60e3) return '刚刚'
  if (diff < 3600e3) return Math.floor(diff / 60e3) + ' 分钟前'
  if (diff < 86400e3) return Math.floor(diff / 3600e3) + ' 小时前'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- resize（透明窗口自绘手柄） ----------
const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
let dir = null
let startX = 0
let startY = 0
let startBounds = null

async function startResize(e, d) {
  if (e.button !== 0) return
  e.preventDefault()
  dir = d
  startX = e.screenX
  startY = e.screenY
  startBounds = await api.getBounds()
  e.currentTarget.setPointerCapture(e.pointerId)
}
function onMove(e) {
  if (!dir || !startBounds) return
  const dx = e.screenX - startX
  const dy = e.screenY - startY
  let { x, y, width, height } = startBounds
  if (dir.includes('e')) width = Math.max(300, startBounds.width + dx)
  if (dir.includes('s')) height = Math.max(360, startBounds.height + dy)
  if (dir.includes('w')) { width = Math.max(300, startBounds.width - dx); x = startBounds.x + (startBounds.width - width) }
  if (dir.includes('n')) { height = Math.max(360, startBounds.height - dy); y = startBounds.y + (startBounds.height - height) }
  api.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) })
}
function endResize() { dir = null; startBounds = null }

onMounted(async () => {
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', endResize)
  window.addEventListener('pointercancel', endResize)
  // resize 手柄用原生绑定（Vue @pointerdown 在 v-for 元素上未生效，见踩坑）
  document.querySelectorAll('.rz').forEach((h) => {
    h.addEventListener('pointerdown', (e) => startResize(e, h.dataset.dir))
  })

  const settings = await api.getSettings()
  themePref.value = settings.theme || 'system'
  applyTheme(themePref.value)
  api.onThemeChanged((t) => { themePref.value = t; applyTheme(t) })
  api.onSystemDark((dark) => { setSystemDark(dark); applyTheme(themePref.value) })
  api.onWindowReset(() => {}) // 收起动画已取消，仅保留通道兼容
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themePref.value === 'system') applyTheme('system')
  })
  api.onNotesChanged(() => { refresh(); if (view.value === 'trash') refreshTrash() })
  api.onListCommand((v) => {
    if (v !== 'trash' && v !== 'notes') return
    view.value = v
    if (v === 'trash') refreshTrash()
    else refresh()
  })
  await refresh()
  await refreshTrash()
})
onUnmounted(() => {
  clearTimeout(emptyTimer)
  clearTimeout(purgeTimer)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', endResize)
  window.removeEventListener('pointercancel', endResize)
})
</script>

<style scoped>
.list-app { flex: 1; display: flex; flex-direction: column; min-height: 0; }

/* MD3 Small Top App Bar：56dp，surface-container */
.head {
  flex-shrink: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 16px;
  background: var(--md-surface-container);
  border-bottom: 1px solid var(--md-outline-variant);
  /* 注意：不要给拖拽区加 backdrop-filter，会破坏 -webkit-app-region: drag 命中 */
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px; /* title-large 的紧凑档 */
  font-weight: 700;
  font-family: "Microsoft YaHei", "Microsoft YaHei UI", "Segoe UI", sans-serif;
  letter-spacing: .5px;
  color: var(--md-on-surface);
}
/* MD3 Avatar / 图标容器：32dp 圆形 primary-container */
.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--shape-full);
  color: var(--md-on-primary-container);
  font-size: 15px;
  background: var(--md-primary-container);
}
.brand-mark.trash {
  background: var(--md-error-container);
  color: var(--md-on-error-container);
}
.actions { display: flex; gap: 2px; }
/* MD3 Standard icon button：40dp 圆形 + state layer */
.hbtn {
  width: 40px; height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--shape-full);
  background: transparent;
  color: var(--md-on-surface-variant);
  font-size: 14px;
  cursor: pointer;
  transition: color var(--dur-short) var(--md-ease-standard), transform var(--dur-short) var(--md-ease-standard);
}
.hbtn:hover { color: var(--md-primary); }
.hbtn:active { transform: scale(.92); }
.hbtn.on { color: var(--md-primary); }
.hbtn.on::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: currentColor;
  opacity: .12;
  pointer-events: none;
}
.hbtn { position: relative; }
/* MD3 Filled icon button（主操作：新建便笺） */
.hbtn.primary {
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
}
.hbtn.primary:hover { color: var(--md-on-primary-container); box-shadow: var(--elev-1); }
.close:hover { color: var(--md-error); }

/* MD3 Search bar：56dp 全圆角胶囊 + surface-container-high */
.search {
  position: relative;
  flex-shrink: 0;
  padding: 8px 16px 4px;
}
.search-ico {
  position: absolute;
  left: 32px;
  top: 50%;
  transform: translateY(calc(-50% - 2px));
  color: var(--md-on-surface-variant);
  pointer-events: none;
  transition: color var(--dur-short) var(--md-ease-standard);
}
.search:focus-within .search-ico { color: var(--md-primary); }
.search-input {
  width: 100%; box-sizing: border-box;
  height: 52px;
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-xl);
  background: var(--md-surface-container-high);
  color: var(--md-on-surface);
  padding: 0 44px;
  outline: none;
  font-size: 15px;
  transition: border-color var(--dur-short) var(--md-ease-standard), box-shadow var(--dur-short) var(--md-ease-standard);
}
.search-input::placeholder { color: var(--md-on-surface-variant); }
.search-input:focus {
  border-color: var(--md-primary);
  box-shadow: var(--elev-1);
}
.search-clear {
  position: absolute;
  right: 30px;
  top: 50%;
  transform: translateY(calc(-50% - 2px));
  width: 32px; height: 32px;
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
.search-clear:hover { color: var(--md-primary); }

.grid {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.empty {
  color: var(--md-on-surface-variant);
  text-align: center;
  padding: 56px 20px;
  font-size: 13px;
}
.leaf { display: block; font-size: 28px; margin-bottom: 10px; opacity: .45; color: var(--md-primary); }

/* ---------- 回收站 ---------- */
.trash-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px 2px;
}
.trash-hint { font-size: 11.5px; color: var(--md-on-surface-variant); }
/* MD3 Text button（危险态用 error） */
.trash-empty {
  flex-shrink: 0;
  border: none;
  border-radius: var(--shape-full);
  padding: 8px 14px;
  font-size: 12.5px;
  font-weight: 500;
  background: var(--md-error-container);
  color: var(--md-on-error-container);
  cursor: pointer;
  transition: box-shadow var(--dur-short) var(--md-ease-standard), transform var(--dur-short) var(--md-ease-standard);
}
.trash-empty:hover { box-shadow: var(--elev-1); }
.trash-empty:active { transform: scale(.96); }

/* MD3 Outlined card */
.trash-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-shrink: 0;
  padding: 12px 12px 11px 14px;
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-m);
  background: var(--md-surface-container-low);
  box-shadow: var(--elev-0);
  animation: card-in var(--dur-medium) var(--md-ease-emphasized) backwards;
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(8px) scale(.985); }
}
.color-dot {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  margin-top: 6px;
  border-radius: var(--shape-full);
}
.trash-body { flex: 1; min-width: 0; }
.trash-title {
  font-weight: 700;
  font-size: 14px;
  font-family: "Microsoft YaHei", "Microsoft YaHei UI", "Segoe UI", sans-serif;
  color: var(--md-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trash-preview {
  font-size: 13px;
  color: var(--md-on-surface-variant);
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.trash-time { font-size: 11px; color: var(--md-on-surface-variant); margin-top: 5px; opacity: .75; }
.trash-acts { flex: 0 0 auto; display: flex; gap: 2px; }
/* MD3 图标按钮 */
.t-act {
  height: 36px;
  min-width: 36px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--shape-full);
  background: transparent;
  color: var(--md-on-surface-variant);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--dur-short) var(--md-ease-standard), transform var(--dur-short) var(--md-ease-standard);
}
.t-act:hover { color: var(--md-primary); }
.t-act:active { transform: scale(.92); }
.t-act.danger:hover { color: var(--md-error); }
/* 二次确认：filled tonal（error 容器） */
.t-act.danger.confirm {
  background: var(--md-error);
  color: var(--md-on-error);
}
footer {
  flex-shrink: 0;
  text-align: center;
  font-size: 11px;
  color: var(--md-on-surface-variant);
  padding: 8px 0 10px;
  border-top: 1px solid var(--md-outline-variant);
  opacity: .8;
}
</style>
