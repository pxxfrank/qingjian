// 预加载脚本：安全桥接渲染进程与主进程
const { contextBridge, ipcRenderer } = require('electron')

// 无 GPU / 远程桌面下的软件渲染降级：给根元素打标记，CSS 据此关闭动效、去掉透明留白
const SOFT_RENDER = process.argv.includes('--qj-soft-render')
if (SOFT_RENDER) {
  const mark = () => document.documentElement.classList.add('soft-render')
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mark, { once: true })
  } else {
    mark()
  }
}

contextBridge.exposeInMainWorld('api', {
  softRender: SOFT_RENDER,
  // 便笺
  listNotes: () => ipcRenderer.invoke('notes:list'),
  readNote: (id) => ipcRenderer.invoke('note:read', id),
  saveNote: (id, payload) => ipcRenderer.invoke('note:save', id, payload),
  saveNoteSync: (id, payload) => ipcRenderer.sendSync('note:save-sync', id, payload),
  createNote: () => ipcRenderer.invoke('note:create'),
  deleteNote: (id) => ipcRenderer.invoke('note:delete', id),
  openNote: (id, query) => ipcRenderer.send('window:open-note', id, query),
  pickImage: () => ipcRenderer.invoke('image:pick'),
  saveImageData: (dataUrl) => ipcRenderer.invoke('image:save-data', dataUrl),

  // 全文搜索
  searchNotes: (q) => ipcRenderer.invoke('search:query', q),
  openQuickFind: () => ipcRenderer.send('window:open-quickfind'),
  quickFindClose: () => ipcRenderer.send('quickfind:close'),

  // 回收站
  listTrash: () => ipcRenderer.invoke('trash:list'),
  restoreTrash: (id) => ipcRenderer.invoke('trash:restore', id),
  purgeTrash: (id) => ipcRenderer.invoke('trash:purge', id),
  emptyTrash: () => ipcRenderer.invoke('trash:empty'),

  // 窗口
  setAlwaysOnTop: (flag) => ipcRenderer.send('window:set-always-on-top', flag),
  hideToDock: () => ipcRenderer.send('window:hide-to-dock'), // 收起到贴边
  minimize: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  getBounds: () => ipcRenderer.invoke('window:get-bounds'),
  setBounds: (bounds) => ipcRenderer.send('window:set-bounds', bounds),

  // 查找（便笺内 Ctrl+F）
  findQuery: (payload) => ipcRenderer.send('find:query', payload),
  findStop: () => ipcRenderer.send('find:stop'),

  // 速记条
  captureSave: (payload) => ipcRenderer.invoke('capture:save', payload),
  captureClose: () => ipcRenderer.send('capture:close'),

  // 贴边启动器
  getLauncher: () => ipcRenderer.invoke('launcher:get'),
  getLauncherItems: () => ipcRenderer.invoke('launcher:items'),
  setLauncherEdge: (mode) => ipcRenderer.invoke('launcher:set-edge', mode),
  openList: () => ipcRenderer.send('launcher:open-list'),
  launcherCreateNote: () => ipcRenderer.invoke('launcher:create-note'),
  launcherDragStart: (x, y) => ipcRenderer.send('launcher:drag-start', x, y),
  launcherDragMove: (x, y) => ipcRenderer.send('launcher:drag', x, y),
  launcherDragEnd: () => ipcRenderer.send('launcher:drag-end'),

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (patch) => ipcRenderer.invoke('settings:set', patch),

  // 主进程推送事件
  onNotesChanged: (cb) => ipcRenderer.on('notes:changed', () => cb()),
  onListCommand: (cb) => ipcRenderer.on('list:view', (_e, view) => cb(view)),
  onThemeChanged: (cb) => ipcRenderer.on('theme:changed', (_e, theme) => cb(theme)),
  onSystemDark: (cb) => ipcRenderer.on('theme:system-dark', (_e, dark) => cb(dark)),
  onLauncherState: (cb) => ipcRenderer.on('launcher:state', (_e, state) => cb(state)),
  onLauncherItems: (cb) => ipcRenderer.on('launcher:items', (_e, items) => cb(items)),
  onLauncherPulse: (cb) => ipcRenderer.on('launcher:pulse', (_e, pulse) => cb(pulse)),
  onFindResult: (cb) => ipcRenderer.on('find:result', (_e, res) => cb(res)),
  onCaptureReset: (cb) => ipcRenderer.on('capture:reset', () => cb()),
  onQuickFindReset: (cb) => ipcRenderer.on('quickfind:reset', () => cb()),
  onWindowReset: (cb) => ipcRenderer.on('window:reset', () => cb())
})
