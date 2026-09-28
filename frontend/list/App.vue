<template>
  <div class="list-app">
    <header class="head drag">
      <div class="brand-wrap no-drag">
        <button
          class="brand"
          id="brandBtn"
          :class="{ on: menuOpen }"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          title="菜单：回收站 / 主题 / Markdown 语法"
          @click="menuOpen = !menuOpen"
        >
          <span class="brand-mark" :class="{ trash: view === 'trash' }">{{ view === 'trash' ? '♻' : '❈' }}</span>
          <span>{{ view === 'trash' ? '回收站' : '轻笺' }}</span>
          <Icon name="chevron-down" class="brand-caret" />
        </button>

        <template v-if="menuOpen">
          <div class="menu-scrim" @click="menuOpen = false"></div>
          <div class="menu" role="menu">
            <button class="menu-item" @click="menuTrash">
              <Icon :name="view === 'trash' ? 'list' : 'history'" />
              <span>{{ view === 'trash' ? '返回便笺列表' : '回收站' }}</span>
              <span v-if="view !== 'trash' && trashCount" class="menu-badge">{{ trashCount }}</span>
              <Icon v-if="view === 'trash'" name="check" class="menu-tail" />
            </button>
            <div class="menu-sep"></div>
            <div class="menu-label">主题</div>
            <button
              v-for="t in themeOptions"
              :key="t.value"
              class="menu-item"
              :data-pref="t.value"
              @click="pickTheme(t.value)"
            >
              <Icon :name="t.icon" /><span>{{ t.label }}</span>
              <Icon v-if="themePref === t.value" name="check" class="menu-tail" />
            </button>
            <div class="menu-sep"></div>
            <button class="menu-item" @click="openSyntax">
              <Icon name="help" /><span>Markdown 语法说明</span>
            </button>
          </div>
        </template>
      </div>
      <div class="actions no-drag">
        <button class="hbtn md-state" id="dockBtn" title="收起到贴边" @click="hideToDock"><Icon name="collapse" /></button>
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

    <!-- Markdown 语法说明 -->
    <div v-if="syntaxOpen" class="modal-scrim no-drag" @click.self="syntaxOpen = false">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <span class="modal-title">Markdown 语法说明</span>
          <button class="hbtn md-state close" title="关闭" @click="syntaxOpen = false"><Icon name="x" /></button>
        </div>
        <div class="modal-body">
          <div v-for="g in syntaxGroups" :key="g.name" class="syn-group">
            <div class="syn-group-name">{{ g.name }}</div>
            <div v-for="row in g.rows" :key="row.code" class="syn-row">
              <code class="syn-code">{{ row.code }}</code>
              <span class="syn-desc">{{ row.desc }}</span>
            </div>
          </div>
          <p class="syn-tip">在便笺里直接输入左侧符号即可自动转换；图片可直接粘贴或拖入。</p>
        </div>
      </div>
    </div>

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
const menuOpen = ref(false)
const syntaxOpen = ref(false)
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

const themeOptions = [
  { value: 'system', label: '跟随系统', icon: 'contrast' },
  { value: 'white', label: '白底', icon: 'square' },
  { value: 'light', label: '浅色', icon: 'sun' },
  { value: 'dark', label: '深色', icon: 'moon' }
]

// Markdown 语法说明（与 engine.js 支持的能力保持一致）
const syntaxGroups = [
  {
    name: '块级',
    rows: [
      { code: '# 标题', desc: '一~六级标题（# 到 ######）' },
      { code: '- 项目', desc: '无序列表（- / * / +）' },
      { code: '1. 项目', desc: '有序列表' },
      { code: '[] 待办', desc: '复选框（[x] 表示已完成）' },
      { code: '> 引用', desc: '引用块' }
    ]
  },
  {
    name: '行内',
    rows: [
      { code: '**粗体**', desc: '加粗' },
      { code: '*斜体*', desc: '斜体（也可写 _斜体_）' },
      { code: '__下划线__', desc: '下划线' },
      { code: '~~删除线~~', desc: '删除线' },
      { code: '`代码`', desc: '行内代码' }
    ]
  },
  {
    name: '操作 / 快捷键',
    rows: [
      { code: 'Ctrl + F', desc: '在便笺内查找' },
      { code: 'Ctrl + S', desc: '立即保存' },
      { code: 'Ctrl + Shift + S', desc: '切换删除线' },
      { code: '粘贴 / 拖入图片', desc: '插入图片（存为附件）' },
      { code: '列表最前面按空格', desc: '在列表上方插入空行' }
    ]
  }
]

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

function pickTheme(t) {
  themePref.value = t
  applyTheme(t)
  api.setSetting({ theme: t })
  menuOpen.value = false
}

async function menuTrash() {
  menuOpen.value = false
  await toggleView()
}

function openSyntax() {
  menuOpen.value = false
  syntaxOpen.value = true
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
.brand-wrap { position: relative; flex: 0 1 auto; min-width: 0; }
/* 品牌区 = 下拉菜单触发器（回收站 / 主题 / Markdown 语法说明都收进这里） */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 4px 4px;
  border: none;
  background: transparent;
  border-radius: var(--shape-full);
  cursor: pointer;
  font-size: 20px; /* title-large 的紧凑档 */
  font-weight: 700;
  font-family: "Microsoft YaHei", "Microsoft YaHei UI", "Segoe UI", sans-serif;
  letter-spacing: .5px;
  color: var(--md-on-surface);
  transition: background var(--dur-short) var(--md-ease-standard);
}
.brand:hover,
.brand.on { background: color-mix(in srgb, var(--md-on-surface) 8%, transparent); }
.brand-caret { width: 16px; height: 16px; color: var(--md-on-surface-variant); }
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

/* ---------- 品牌下拉菜单 ---------- */
.menu-scrim { position: fixed; inset: 0; z-index: 40; }
.menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 41;
  min-width: 210px;
  padding: 6px;
  background: var(--md-surface-container-high);
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-m);
  box-shadow: var(--elev-2);
  animation: menu-in var(--dur-short) var(--md-ease-emphasized);
}
@keyframes menu-in { from { opacity: 0; transform: translateY(-4px); } }
.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: var(--shape-s);
  color: var(--md-on-surface);
  font: inherit;
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur-short) var(--md-ease-standard);
}
.menu-item:hover { background: color-mix(in srgb, var(--md-primary) 12%, transparent); }
.menu-item .icon { color: var(--md-on-surface-variant); }
.menu-item .menu-tail { margin-left: auto; color: var(--md-primary); }
.menu-badge {
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--shape-full);
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
  font-size: 11.5px;
  font-weight: 700;
}
.menu-label { padding: 6px 10px 2px; font-size: 11px; color: var(--md-on-surface-variant); }
.menu-sep { height: 1px; margin: 4px 6px; background: var(--md-outline-variant); }

/* ---------- Markdown 语法说明弹层 ---------- */
.modal-scrim {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, .38);
}
.modal {
  width: 100%;
  max-width: 380px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--md-surface-container-high);
  border-radius: var(--shape-l);
  box-shadow: var(--elev-3);
  overflow: hidden;
}
.modal-head { display: flex; align-items: center; gap: 8px; padding: 10px 8px 10px 18px; }
.modal-title { flex: 1; font-size: 15px; font-weight: 700; color: var(--md-on-surface); }
.modal-body { overflow: auto; padding: 0 18px 18px; }
.syn-group { margin-top: 12px; }
.syn-group-name { margin-bottom: 6px; font-size: 12px; color: var(--md-on-surface-variant); }
.syn-row { display: flex; align-items: baseline; gap: 12px; padding: 4px 0; }
.syn-code {
  flex: 0 0 122px;
  padding: 2px 8px;
  border-radius: var(--shape-xs);
  background: var(--md-surface-container-highest);
  font-family: "Roboto Mono", "Cascadia Mono", Consolas, monospace;
  font-size: 12.5px;
  color: var(--md-on-surface);
}
.syn-desc { font-size: 12.5px; color: var(--md-on-surface-variant); }
.syn-tip { margin: 16px 0 0; font-size: 12px; line-height: 1.6; color: var(--md-on-surface-variant); }
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

/* 搜索框：圆角与便笺卡片保持一致（--shape-m）+ surface-container-high */
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
  border-radius: var(--shape-m);
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
