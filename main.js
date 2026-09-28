// 主进程：窗口管理、贴边启动器、速记条、全局热键、IPC、便笺存储、系统托盘
const {
  app, BrowserWindow, ipcMain, nativeTheme, dialog, Tray, Menu, nativeImage,
  protocol, net, globalShortcut
} = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { pathToFileURL } = require('url')
const { createStore } = require('./store')
const { createLauncher } = require('./launcher')

const NOTE_MIN_W = 380 // 便笺窗最小宽度：标题 ≥96px 且标题栏图标完整显示
const LIST_MIN_W = 340 // 列表窗最小宽度：卡片标题保持横向单行
const CAPTURE_W = 480
const CAPTURE_H = 80 // MD3 搜索条 56dp + 上下留白
const LAUNCHER_WIN = 76 // 贴边启动器窗口（2×WIN_R，与 launcher-geometry 一致）
// 全局热键候选：按顺序尝试，第一个注册成功的生效（Alt+Space 可能被系统窗口菜单占用）
const SHORTCUT_CANDIDATES = ['Alt+Space', 'Ctrl+Alt+Space', 'Alt+Shift+Space']

// 附件协议：图片落盘到 userData/attachments，用 note-att://local/<file> 读取，
// 避免把 base64 塞进便笺 JSON（一张截图就能让文件涨到数 MB）。
protocol.registerSchemesAsPrivileged([
  { scheme: 'note-att', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

const store = createStore(
  path.join(app.getPath('userData'), 'notes'),
  path.join(app.getPath('userData'), 'settings.json')
)

// ---------- 单例锁 ----------
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showWindow(listWin)
  })
}

let listWin = null
const noteWins = new Map() // id -> BrowserWindow
let launcherWin = null
let launcherCtrl = null
let captureWin = null
let tray = null
let isQuitting = false
let captureShortcut = ''

// 被「收起到贴边」的窗口：只有这些才出现在小球里
const minimizedNotes = new Set()
let listMinimized = false

// ---------- 附件（图片） ----------
function attachmentsDir() {
  return path.join(app.getPath('userData'), 'attachments')
}

const MIME_EXT = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/gif': '.gif',
  'image/webp': '.webp', 'image/bmp': '.bmp', 'image/svg+xml': '.svg'
}

// 按内容哈希命名 → 同图重复插入不重复占空间
function saveAttachment(buffer, ext) {
  const dir = attachmentsDir()
  fs.mkdirSync(dir, { recursive: true })
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 16)
  const name = `${hash}${ext}`
  const file = path.join(dir, name)
  if (!fs.existsSync(file)) fs.writeFileSync(file, buffer)
  return `note-att://local/${name}`
}

function handleAttachmentProtocol() {
  protocol.handle('note-att', (request) => {
    try {
      const raw = new URL(request.url).pathname.replace(/^\//, '')
      const name = path.basename(decodeURIComponent(raw)) // 只取文件名，防目录穿越
      const file = path.join(attachmentsDir(), name)
      if (!fs.existsSync(file)) return new Response('Not found', { status: 404 })
      return net.fetch(pathToFileURL(file).toString())
    } catch {
      return new Response('Bad request', { status: 400 })
    }
  })
}

// ---------- 贴边启动器 ----------
// 收起 = 边缘半个小球；鼠标移上小球 → 展开成扁长横条（列表 + 被收起的便笺 + 新建）
function createLauncherWindow() {
  const settings = store.readSettings()
  launcherWin = new BrowserWindow({
    width: LAUNCHER_WIN,
    height: LAUNCHER_WIN,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })
  launcherWin.loadFile(path.join(__dirname, 'frontend', 'dist', 'launcher', 'index.html'))
  launcherCtrl = createLauncher(launcherWin, {
    edge: settings.launcher === 'left' ? 'left' : 'right',
    y: typeof settings.launcherY === 'number' ? settings.launcherY : null,
    count: 3
  })
  launcherWin.on('closed', () => {
    launcherCtrl?.destroy()
    launcherCtrl = null
    launcherWin = null
  })
  launcherWin.webContents.on('did-finish-load', () => refreshLauncher())
}

function launcherItems() {
  const notes = []
  for (const id of [...minimizedNotes]) {
    const note = store.readNote(id)
    if (!note) {
      minimizedNotes.delete(id)
      continue
    }
    notes.push({ id, title: note.title || '', color: note.color || 'yellow' })
  }
  return { notes, list: listMinimized }
}

function broadcastLauncherItems() {
  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.webContents.send('launcher:items', launcherItems())
  }
}

// 依据「被收起的窗口数」刷新横条内容；小球始终常驻显示
function refreshLauncher() {
  const items = launcherItems()
  const total = items.notes.length + (items.list ? 1 : 0)
  launcherCtrl?.setCount(total + 2) // ☰ 列表 + 被收起的窗口 + ＋ 新建
  launcherCtrl?.show()
  broadcastLauncherItems()
}

// 让小球播放「捕获」反馈（涟漪 + 弹跳），颜色取自被收起的便笺
function pulseBall(color) {
  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.webContents.send('launcher:pulse', { color: color || 'accent' })
  }
}

function applyLauncherEdge(mode) {
  const m = mode === 'left' ? 'left' : 'right'
  store.writeSettings({ launcher: m })
  launcherCtrl?.setEdge(m)
  buildTray()
}

function showWindow(win) {
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.webContents.send('window:reset') // 清除历史状态残留（动画已取消，仅保留兜底）
  win.show()
  win.focus()
}

// ---------- 速记条（全局热键唤起） ----------
function createCaptureWindow() {
  captureWin = new BrowserWindow({
    width: CAPTURE_W,
    height: CAPTURE_H,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })
  captureWin.loadFile(path.join(__dirname, 'frontend', 'dist', 'capture', 'index.html'))
  captureWin.on('blur', () => {
    if (captureWin && !captureWin.isDestroyed() && !captureWin.__saving) captureWin.hide()
  })
  captureWin.on('closed', () => { captureWin = null })
}

function toggleCapture() {
  if (!captureWin || captureWin.isDestroyed()) createCaptureWindow()
  if (captureWin.isVisible()) {
    captureWin.hide()
    return
  }
  const { screen } = require('electron')
  const cur = screen.getCursorScreenPoint()
  const wa = screen.getDisplayNearestPoint(cur).workArea
  const x = Math.round(Math.min(Math.max(cur.x - CAPTURE_W / 2, wa.x + 12), wa.x + wa.width - CAPTURE_W - 12))
  const y = Math.round(Math.min(Math.max(cur.y + 18, wa.y + 12), wa.y + wa.height - CAPTURE_H - 12))
  captureWin.__saving = false
  captureWin.webContents.send('window:reset')
  captureWin.setBounds({ x, y, width: CAPTURE_W, height: CAPTURE_H })
  captureWin.showInactive()
  captureWin.focus()
  captureWin.webContents.send('capture:reset')
}

function registerShortcuts() {
  for (const acc of SHORTCUT_CANDIDATES) {
    try {
      if (globalShortcut.register(acc, toggleCapture)) {
        captureShortcut = acc
        break
      }
    } catch { /* 注册失败则尝试下一个 */ }
  }
}

// ---------- 窗口 ----------
function createListWindow() {
  listWin = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: LIST_MIN_W,
    minHeight: 360,
    frame: false,            // 无边框 + 自绘标题栏：彻底去掉系统菜单栏
    transparent: true,       // 配合 CSS 圆角实现柔和外观
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  listWin.loadFile(path.join(__dirname, 'frontend', 'dist', 'list', 'index.html'))
  listWin.once('ready-to-show', () => listWin.show())
  listWin.on('close', (e) => {
    // 关闭列表窗口 → 隐藏到托盘，而非退出（托盘「退出」才真正退出）
    if (!isQuitting) {
      e.preventDefault()
      listWin.hide()
    }
  })
  listWin.on('closed', () => { listWin = null })
}

function createNoteWindow(id, bounds) {
  const win = new BrowserWindow({
    width: bounds?.width || 380,
    height: bounds?.height || 260,
    x: bounds?.x,
    y: bounds?.y,
    // 最小尺寸要装得下「标题（≥72px）+ 标题栏图标」，否则图标会被挤出可视区
    minWidth: NOTE_MIN_W,
    minHeight: 200,
    frame: false,            // 无边框便笺风格
    transparent: true,       // CSS 圆角
    resizable: true,         // 自绘 resize 手柄实现调整大小
    alwaysOnTop: true,       // 默认悬浮置顶
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })
  win.loadFile(path.join(__dirname, 'frontend', 'dist', 'note', 'index.html'), { query: { id } })
  win.__noteId = id
  win.once('ready-to-show', () => win.show())
  // 查找：把命中数/当前命中序号回传渲染层
  win.webContents.on('found-in-page', (_e, result) => {
    if (win.isDestroyed()) return
    win.webContents.send('find:result', {
      matches: result.matches || 0,
      active: result.activeMatchOrdinal || 0
    })
  })
  noteWins.set(id, win)
  win.on('close', () => {
    // 关闭前记住窗口位置/大小，下次打开恢复
    const note = store.readNote(id)
    if (note) {
      const [x, y] = win.getPosition()
      const [width, height] = win.getSize()
      store.writeNote(id, { bounds: { x, y, width, height } })
    }
  })
  win.on('closed', () => {
    noteWins.delete(id)
  })
  return win
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function createNewNote() {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  store.writeNote(id, { title: '', html: '', createdAt: Date.now(), color: 'yellow' })
  createNoteWindow(id)
  broadcastNotes(id)
  return id
}

// 打开便笺：若之前被收起，则先恢复
function openNote(id) {
  minimizedNotes.delete(id)
  const existing = noteWins.get(id)
  if (existing && !existing.isDestroyed()) {
    showWindow(existing)
  } else {
    createNoteWindow(id, store.readNote(id)?.bounds)
  }
  refreshLauncher()
}

// 便笺集合变化：刷新列表窗口 + 启动器
function broadcastNotes(id) {
  if (listWin && !listWin.isDestroyed()) listWin.webContents.send('notes:changed', id)
  broadcastLauncherItems()
}

// ---------- 系统托盘 ----------
function buildTray() {
  if (!tray) return
  const edge = store.readSettings().launcher === 'left' ? 'left' : 'right'
  const trashCount = store.trashCount()
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示便笺列表', click: () => showWindow(listWin) },
    { label: captureShortcut ? `速记条（${captureShortcut}）` : '速记条', click: () => toggleCapture() },
    { label: '新建便笺', click: () => createNewNote() },
    { type: 'separator' },
    {
      label: `回收站${trashCount ? `（${trashCount}）` : ''}`,
      submenu: [
        { label: '打开回收站', click: () => { showWindow(listWin); showListView('trash') } },
        { label: '清空回收站', click: () => { store.emptyTrash(); buildTray(); broadcastNotes(null) } }
      ]
    },
    {
      label: '贴边位置',
      submenu: [
        { label: '贴右侧', type: 'radio', checked: edge === 'right', click: () => applyLauncherEdge('right') },
        { label: '贴左侧', type: 'radio', checked: edge === 'left', click: () => applyLauncherEdge('left') }
      ]
    },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit() } }
  ]))
}

function showListView(view) {
  if (listWin && !listWin.isDestroyed()) {
    showWindow(listWin)
    listWin.webContents.send('list:view', view)
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'build', 'icon.png')
  let icon = nativeImage.createEmpty()
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  }
  tray = new Tray(icon)
  tray.setToolTip('轻笺')
  buildTray()
  tray.on('click', () => showWindow(listWin))
}

// ---------- IPC ----------
ipcMain.handle('notes:list', () => {
  return store.listNotes().map((meta) => {
    const note = store.readNote(meta.id)
    return {
      ...meta,
      title: note?.title || '',
      preview: note?.preview || '',
      pinned: !!note?.pinned,
      color: note?.color || 'yellow'
    }
  })
})

ipcMain.handle('note:read', (_e, id) => store.readNote(id))

ipcMain.handle('note:save', (_e, id, payload) => {
  const saved = store.writeNote(id, payload)
  broadcastNotes(id)
  return saved
})

// 同步保存：窗口卸载前（关闭/退出）调用，确保最后输入不丢
ipcMain.on('note:save-sync', (e, id, payload) => {
  try {
    const saved = store.writeNote(id, payload)
    broadcastNotes(id)
    e.returnValue = !!saved
  } catch {
    e.returnValue = false
  }
})

ipcMain.handle('note:create', () => createNewNote())

// 删除 = 移入回收站（可在列表窗口恢复）
ipcMain.handle('note:delete', (_e, id) => {
  store.moveToTrash(id)
  minimizedNotes.delete(id)
  const win = noteWins.get(id)
  if (win && !win.isDestroyed()) win.close()
  broadcastNotes(id)
  refreshLauncher()
  buildTray()
  return true
})

// ---------- 回收站 ----------
ipcMain.handle('trash:list', () => store.listTrash())

ipcMain.handle('trash:restore', (_e, id) => {
  const note = store.restoreNote(id)
  if (note) {
    broadcastNotes(id)
    buildTray()
  }
  return !!note
})

ipcMain.handle('trash:purge', (_e, id) => {
  const ok = store.purgeNote(id)
  buildTray()
  return ok
})

ipcMain.handle('trash:empty', () => {
  const n = store.emptyTrash()
  buildTray()
  return n
})

ipcMain.on('window:open-note', (_e, id) => openNote(id))

ipcMain.on('window:set-always-on-top', (e, flag) => {
  BrowserWindow.fromWebContents(e.sender)?.setAlwaysOnTop(flag)
})

// 收起到贴边：直接隐藏窗口，并让小球播放「已收起」的涟漪反馈（不做缩小动画）
ipcMain.on('window:hide-to-dock', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return
  if (win.__noteId) minimizedNotes.add(win.__noteId)
  else if (win === listWin) listMinimized = true
  refreshLauncher()
  win.hide()
  const color = win.__noteId ? (store.readNote(win.__noteId)?.color || 'yellow') : 'accent'
  pulseBall(color)
})

// 便笺内查找（Ctrl+F）
ipcMain.on('find:query', (e, payload) => {
  const { text, forward = true, findNext = false } = payload || {}
  const wc = e.sender
  if (!text) {
    wc.stopFindInPage('clearSelection')
    wc.send('find:result', { matches: 0, active: 0 })
    return
  }
  wc.findInPage(text, { forward, findNext })
})

ipcMain.on('find:stop', (e) => {
  try { e.sender.stopFindInPage('clearSelection') } catch { /* ignore */ }
  e.sender.send('find:result', { matches: 0, active: 0 })
})

// 速记条：保存为便笺 → 缩进小球（或直接打开编辑）
ipcMain.handle('capture:save', (_e, payload) => {
  const text = ((payload && payload.text) || '').trim()
  if (!text) return null
  const lines = text.split(/\r?\n/)
  const title = (lines[0] || '').trim().slice(0, 60)
  const html = lines.map((l) => `<p>${escapeHtml(l) || '<br>'}</p>`).join('')
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  store.writeNote(id, {
    title,
    html,
    preview: text.replace(/\s+/g, ' ').slice(0, 100),
    createdAt: Date.now(),
    color: 'yellow'
  })
  broadcastNotes(id)
  if (payload && payload.open) {
    if (captureWin && !captureWin.isDestroyed()) captureWin.hide()
    openNote(id)
  } else if (captureWin && !captureWin.isDestroyed()) {
    // 存入后直接收起速记条，小球给出涟漪反馈（不做缩小动画）
    captureWin.__saving = true
    captureWin.hide()
    pulseBall('yellow')
  }
  return id
})

ipcMain.on('capture:close', () => {
  if (captureWin && !captureWin.isDestroyed()) captureWin.hide()
})

// 贴边启动器
ipcMain.handle('launcher:get', () => ({
  edge: launcherCtrl?.edge || 'right',
  expanded: !!launcherCtrl?.expanded,
  visible: !!launcherCtrl?.visible,
  count: launcherCtrl?.count || 0
}))

ipcMain.handle('launcher:items', () => launcherItems())

ipcMain.handle('launcher:set-edge', (_e, mode) => {
  applyLauncherEdge(mode)
  return mode === 'left' ? 'left' : 'right'
})

ipcMain.on('launcher:open-list', () => {
  listMinimized = false
  if (!listWin || listWin.isDestroyed()) createListWindow()
  showListView('notes')
  refreshLauncher()
})

ipcMain.handle('launcher:create-note', () => createNewNote())

ipcMain.on('launcher:drag-start', (_e, x, y) => launcherCtrl?.dragStart(x, y))
ipcMain.on('launcher:drag', (_e, x, y) => launcherCtrl?.dragMove(x, y))
ipcMain.on('launcher:drag-end', () => {
  launcherCtrl?.dragEnd()
  const patch = {}
  const y = launcherCtrl?.getY()
  if (typeof y === 'number') patch.launcherY = y
  if (launcherCtrl) patch.launcher = launcherCtrl.edge
  if (Object.keys(patch).length) store.writeSettings(patch)
  buildTray()
})

// 设置
// 系统深色：以主进程 nativeTheme 为准（比渲染层 prefers-color-scheme 更权威），
// 系统主题切换时主动广播，避免「跟随系统」停在亮色。
function broadcastSystemDark() {
  const dark = nativeTheme.shouldUseDarkColors
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('theme:system-dark', dark)
  }
}
nativeTheme.on('updated', broadcastSystemDark)

ipcMain.handle('settings:get', () => store.readSettings())

ipcMain.handle('settings:set', (_e, patch) => {
  const merged = store.writeSettings(patch)
  if (patch.theme) {
    // nativeTheme 只接受 system/light/dark；自定义「白底 white」映射为 light
    const src = patch.theme === 'dark' ? 'dark' : patch.theme === 'system' ? 'system' : 'light'
    nativeTheme.themeSource = src
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('theme:changed', merged.theme)
    }
  }
  if ('launcher' in patch) applyLauncherEdge(merged.launcher)
  return merged
})

// 渲染进程窗口控制（无边框窗口的自定义标题栏）
ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
ipcMain.handle('window:get-bounds', (e) => BrowserWindow.fromWebContents(e.sender)?.getBounds())
ipcMain.on('window:set-bounds', (e, bounds) => {
  BrowserWindow.fromWebContents(e.sender)?.setBounds(bounds)
})

// 插入图片：选择文件 → 落盘为附件（返回 note-att:// 地址）
ipcMain.handle('image:pick', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const result = await dialog.showOpenDialog(win, {
    title: '插入图片',
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths.length) return null
  const file = result.filePaths[0]
  const ext = path.extname(file).toLowerCase() || '.png'
  return saveAttachment(fs.readFileSync(file), MIME_EXT[`image/${ext.slice(1)}`] || ext)
})

// 粘贴/拖入的图片（data URL）→ 落盘为附件
ipcMain.handle('image:save-data', (_e, dataUrl) => {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl || '')
  if (!m) return null
  return saveAttachment(Buffer.from(m[2], 'base64'), MIME_EXT[m[1]] || '.png')
})

// ---------- 应用生命周期 ----------
const initialTheme = store.readSettings().theme || 'system'
nativeTheme.themeSource = initialTheme === 'dark' ? 'dark' : initialTheme === 'system' ? 'system' : 'light'

app.whenReady().then(() => {
  store.ensureNotesDir()
  store.pruneTrash() // 清理超过保留期的回收站内容
  handleAttachmentProtocol()
  createListWindow()
  createLauncherWindow()
  createTray()
  registerShortcuts()
  // 窗口就绪后再广播一次，确保「跟随系统」拿到的是最新的系统深色状态
  setTimeout(broadcastSystemDark, 300)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createListWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // 有托盘常驻，不退出（退出仅通过托盘菜单）
})
