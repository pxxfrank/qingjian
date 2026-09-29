// E2E 测试基础设施：临时存储 + IPC 注册 + 窗口创建 + 输入模拟
const { BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { createStore } = require('../store')
const { createNoteIndex } = require('../note-index')

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

let store = null
let noteIndex = null
let lastOpened = null
let listWin = null
const stats = { pass: 0, fail: 0, failures: [] }

function ok(name, cond, extra) {
  if (cond) { stats.pass++; console.log('  PASS  ' + name) }
  else {
    stats.fail++
    console.log('  FAIL  ' + name + (extra !== undefined ? '  => ' + extra : ''))
    stats.failures.push(name)
  }
}

function initStore(tmpDir) {
  store = createStore(path.join(tmpDir, 'notes'), path.join(tmpDir, 'settings.json'))
  store.ensureNotesDir()
  noteIndex = createNoteIndex(store)
  return store
}

// 与 main.js 契约一致的全文搜索（供 search:query 桩使用）
function countOccurrences(hay, needle) {
  if (!needle) return 0
  let n = 0
  let i = 0
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length }
  return n
}

function searchNotes(rawQuery) {
  const q = (rawQuery || '').trim().toLowerCase()
  if (!q) return []
  const out = []
  for (const note of store.readAllNotes()) {
    const title = note.title || ''
    const rec = noteIndex ? noteIndex.get(note.id) : null
    const text = rec ? rec.text : ''
    const matches = []
    let count = 0
    const tLow = title.toLowerCase()
    const ti = tLow.indexOf(q)
    if (ti !== -1) {
      matches.push({ field: 'title', snippet: title, start: ti, end: ti + q.length })
      count += countOccurrences(tLow, q)
    }
    const bLow = text.toLowerCase()
    const bi = bLow.indexOf(q)
    if (bi !== -1) {
      const s = Math.max(0, bi - 20)
      const e = Math.min(text.length, bi + q.length + 20)
      matches.push({ field: 'body', snippet: text.slice(s, e), start: bi - s, end: bi - s + q.length })
      count += countOccurrences(bLow, q)
    }
    if (!matches.length) continue
    out.push({ id: note.id, title, color: note.color || 'yellow', updatedAt: note.updatedAt || 0, count, matches })
  }
  out.sort((a, b) => {
    const at = a.matches.some((m) => m.field === 'title') ? 1 : 0
    const bt = b.matches.some((m) => m.field === 'title') ? 1 : 0
    if (at !== bt) return bt - at
    return (b.updatedAt || 0) - (a.updatedAt || 0)
  })
  return out
}

// 与 main.js 契约一致的 IPC handler（image:pick 用固定 data URL mock）
function registerIpc() {
  ipcMain.handle('notes:list', () => store.listNotes().map((meta) => {
    const note = store.readNote(meta.id)
    return { ...meta, title: note?.title || '', preview: note?.preview || '', pinned: !!note?.pinned, color: note?.color || 'yellow' }
  }))
  ipcMain.handle('note:read', (_e, id) => store.readNote(id))
  ipcMain.handle('note:save', (_e, id, payload) => store.writeNote(id, payload))
  ipcMain.handle('note:create', () => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    store.writeNote(id, { title: '', html: '', createdAt: Date.now() })
    return id
  })
  ipcMain.handle('note:delete', (_e, id) => { store.moveToTrash(id); return true })
  // 同步保存（关闭/退出前 flush，供「保存兜底」用例验证）
  ipcMain.on('note:save-sync', (e, id, payload) => {
    try { store.writeNote(id, payload); e.returnValue = true } catch { e.returnValue = false }
  })
  // 回收站
  ipcMain.handle('trash:list', () => store.listTrash())
  ipcMain.handle('trash:restore', (_e, id) => !!store.restoreNote(id))
  ipcMain.handle('trash:purge', (_e, id) => store.purgeNote(id))
  ipcMain.handle('trash:empty', () => store.emptyTrash())
  ipcMain.handle('settings:get', () => store.readSettings())
  ipcMain.handle('settings:set', (_e, patch) => {
    const merged = store.writeSettings(patch)
    if (patch.theme) {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('theme:changed', merged.theme)
    }
    return merged
  })
  ipcMain.handle('image:pick', () => TINY_PNG)
  ipcMain.handle('image:save-data', () => 'note-att://local/testhash.png')
  ipcMain.handle('window:get-bounds', (e) => BrowserWindow.fromWebContents(e.sender)?.getBounds())
  ipcMain.on('window:set-bounds', (e, b) => BrowserWindow.fromWebContents(e.sender)?.setBounds(b))
  ipcMain.on('window:set-always-on-top', (e, flag) => BrowserWindow.fromWebContents(e.sender)?.setAlwaysOnTop(flag))
  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.on('window:open-note', () => {})
  // 查找（mock：不依赖真实 findInPage，只回一个计数）
  ipcMain.on('find:query', (e, payload) => {
    e.sender.send('find:result', { matches: payload && payload.text ? 1 : 0, active: 1 })
  })
  ipcMain.on('find:stop', (e) => e.sender.send('find:result', { matches: 0, active: 0 }))
  // 全文搜索（与 main.js 契约一致）
  ipcMain.handle('search:query', (_e, q) => searchNotes(q))
  // 记录最后一次「打开便笺」（含可选高亮 query），供搜索结果点击用例断言
  ipcMain.on('window:open-note', (_e, id, q) => { lastOpened = { id, q: typeof q === 'string' ? q : '' } })
  // 快速搜索面板（无窗口控制需求，空实现即可）
  ipcMain.on('window:open-quickfind', () => {})
  ipcMain.on('quickfind:close', () => {})
  // 收起 / 复原（与 main.js 当前实现一致：不做缩放动画，直接隐藏 / 直接显示）
  ipcMain.on('window:hide-to-dock', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win && !win.isDestroyed()) win.hide()
  })
  ipcMain.on('window:open-note', (_e, id) => {
    const win = noteWins.get(id)
    if (win && !win.isDestroyed()) {
      win.webContents.send('window:reset')
      win.show()
    }
  })
  ipcMain.on('launcher:open-list', () => {
    if (listWin && !listWin.isDestroyed()) {
      listWin.webContents.send('window:reset')
      listWin.show()
    }
  })
}

const noteWins = new Map()

async function createNoteWindow(id, opts = {}) {
  const win = new BrowserWindow({
    width: opts.width || 380,
    height: opts.height || 260,
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })
  await win.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'note', 'index.html'), { query: { id } })
  await new Promise((r) => setTimeout(r, 250))
  noteWins.set(id, win)
  win.on('closed', () => noteWins.delete(id))
  return win
}

async function createListWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 640,
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  await win.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'list', 'index.html'))
  await new Promise((r) => setTimeout(r, 250))
  listWin = win
  win.on('closed', () => { if (listWin === win) listWin = null })
  return win
}

async function createQuickFindWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 420,
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })
  await win.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'quickfind', 'index.html'))
  await new Promise((r) => setTimeout(r, 250))
  return win
}

function evalIn(win, code) {
  return win.webContents.executeJavaScript(code, true)
}

// 模拟"光标在行尾输入整行文本并触发 input"（驱动引擎转换，非真实键入）
async function typeText(win, text) {
  return evalIn(win, `(() => {
    const ed = document.getElementById('editor')
    ed.innerHTML = '<p><br></p>'
    const p = ed.querySelector('p')
    p.textContent = ${JSON.stringify(text)}
    const r = document.createRange()
    r.selectNodeContents(p); r.collapse(false)
    const s = getSelection(); s.removeAllRanges(); s.addRange(r)
    ed.dispatchEvent(new InputEvent('input', { bubbles: true }))
    return ed.innerHTML
  })()`)
}

// 真实键盘逐字符输入
async function sendKeys(win, str) {
  for (const ch of str) {
    win.webContents.sendInputEvent({ type: 'char', keyCode: ch })
  }
  await new Promise((r) => setTimeout(r, 80))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

module.exports = {
  stats, ok, initStore, registerIpc,
  createNoteWindow, createListWindow, createQuickFindWindow, evalIn, typeText, sendKeys, sleep,
  getStore: () => store,
  getLastOpened: () => lastOpened
}
