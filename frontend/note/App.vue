<template>
  <div class="note-app">
    <TitleBar
      :title="title"
      :pinned="pinned"
      @update:title="onTitle"
      @toggle-color="showColor = !showColor"
      @find="openFind"
      @toggle-pin="togglePin"
      @hide-to-dock="hideToDock"
      @minimize="api.minimize()"
      @close="api.closeWindow()"
    />
    <FindBar v-if="showFind" @close="closeFind" />
    <ColorPicker v-if="showColor" @pick="pickColor" />
    <EditorToolbar @cmd="onCmd" />
    <div class="editor-wrap">
      <main ref="editorEl" id="editor" contenteditable="true" spellcheck="false"></main>
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
import { ref, onMounted, onUnmounted } from 'vue'
import TitleBar from '../src/components/TitleBar.vue'
import EditorToolbar from '../src/components/EditorToolbar.vue'
import ColorPicker from '../src/components/ColorPicker.vue'
import FindBar from '../src/components/FindBar.vue'
import {
  initEngine, bindEditorEvents, normalize, focusEditorAtEnd,
  exec, heading, listCmd, quoteCmd, inlineCodeCmd, insertImageData, pastePlainText
} from '../src/editor/engine'
import { applyTheme, setSystemDark } from '../src/theme'

const api = window.api
const noteId = new URLSearchParams(location.search).get('id')
const editorEl = ref(null)
const title = ref('')
const pinned = ref(true)
const showColor = ref(false)
const showFind = ref(false)

let saveTimer = null
let dirty = false
let themePref = 'system'

function onTitle(v) {
  title.value = v
  scheduleSave()
}

function scheduleSave() {
  dirty = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 400)
}

function payload() {
  const plain = editorEl.value.innerText.replace(/\s+/g, ' ').trim()
  return {
    html: editorEl.value.innerHTML,
    title: title.value.trim() || plain.slice(0, 30),
    preview: plain.slice(0, 100)
  }
}

function saveNow() {
  clearTimeout(saveTimer)
  if (!dirty) return
  normalize()
  api.saveNote(noteId, payload())
  dirty = false
}

// 关闭窗口 / 退出应用前同步落盘：去抖中的编辑不会再丢
function flushSave() {
  if (!dirty || !editorEl.value) return
  clearTimeout(saveTimer)
  normalize()
  api.saveNoteSync(noteId, payload())
  dirty = false
}

function togglePin() {
  pinned.value = !pinned.value
  api.setAlwaysOnTop(pinned.value)
}

function hideToDock() {
  flushSave()
  api.hideToDock()
}

function openFind() {
  showFind.value = true
}
function closeFind() {
  showFind.value = false
}

function onKeyDown(e) {
  if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault()
    openFind()
    return
  }
  if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    saveNow()
    return
  }
  if (e.key === 'Escape' && showFind.value) {
    e.preventDefault()
    closeFind()
  }
}

function onCmd(cmd) {
  if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline' || cmd === 'strikeThrough') exec(cmd)
  else if (cmd === 'code') inlineCodeCmd()
  else if (cmd === 'image') insertImage()
  else if (cmd.startsWith('h')) heading(+cmd.slice(1))
  else if (cmd === 'ul' || cmd === 'ol' || cmd === 'task') listCmd(cmd)
  else if (cmd === 'quote') quoteCmd()
}

async function insertImage() {
  insertImageData(await api.pickImage())
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 图片落盘为附件（note-att://），不把 base64 塞进便笺正文
async function insertImageFile(file) {
  const dataUrl = await fileToDataUrl(file)
  let src = null
  try { src = await api.saveImageData(dataUrl) } catch { /* 落盘失败则退回内联 */ }
  insertImageData(src || dataUrl)
}

function pickColor(color) {
  document.body.dataset.color = color
  api.saveNote(noteId, { color })
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
  if (dir.includes('e')) width = Math.max(320, startBounds.width + dx)
  if (dir.includes('s')) height = Math.max(200, startBounds.height + dy)
  if (dir.includes('w')) { width = Math.max(320, startBounds.width - dx); x = startBounds.x + (startBounds.width - width) }
  if (dir.includes('n')) { height = Math.max(200, startBounds.height - dy); y = startBounds.y + (startBounds.height - height) }
  api.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) })
}
function endResize() { dir = null; startBounds = null }

onMounted(async () => {
  const el = editorEl.value
  initEngine(el, { onSave: scheduleSave })
  bindEditorEvents()

  // 图片粘贴 / 拖入
  el.addEventListener('paste', async (e) => {
    e.preventDefault()
    let imageFile = null
    const items = e.clipboardData && e.clipboardData.items
    if (items) {
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) { imageFile = item.getAsFile(); break }
      }
    }
    if (imageFile) {
      await insertImageFile(imageFile)
      return
    }
    const text = e.clipboardData.getData('text/plain')
    if (text) pastePlainText(text)
  })
  el.addEventListener('dragover', (e) => e.preventDefault())
  el.addEventListener('drop', async (e) => {
    e.preventDefault()
    const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'))
    if (file) await insertImageFile(file)
  })

  // resize 全局监听
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', endResize)
  window.addEventListener('pointercancel', endResize)
  // resize 手柄用原生绑定
  document.querySelectorAll('.rz').forEach((h) => {
    h.addEventListener('pointerdown', (e) => startResize(e, h.dataset.dir))
  })

  // 快捷键 + 关闭/退出前的兜底保存
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('beforeunload', flushSave)
  window.addEventListener('pagehide', flushSave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave()
  })

  // 数据
  const data = await api.readNote(noteId)
  if (data?.html) el.innerHTML = data.html
  else el.innerHTML = '<p><br></p>'
  if (data?.title) title.value = data.title
  if (data?.color) document.body.dataset.color = data.color

  // 主题
  const settings = await api.getSettings()
  themePref = settings.theme || 'system'
  applyTheme(themePref)
  api.onThemeChanged((t) => applyTheme(t))
  api.onSystemDark((dark) => { setSystemDark(dark); applyTheme(themePref) })
  api.onWindowReset(() => {}) // 收起动画已取消，仅保留通道兼容
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themePref === 'system') applyTheme('system')
  })

  focusEditorAtEnd()
})
onUnmounted(() => {
  flushSave()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('beforeunload', flushSave)
  window.removeEventListener('pagehide', flushSave)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', endResize)
  window.removeEventListener('pointercancel', endResize)
})
</script>

<style scoped>
.note-app { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.editor-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
