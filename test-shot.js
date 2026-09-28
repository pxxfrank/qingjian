// 截图脚本：用与正式应用相同的窗口参数渲染两个页面并截图，验证圆角/毛玻璃效果
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

app.whenReady().then(async () => {
  // 与 test-smoke 相同的 IPC 桩，附带演示数据
  ipcMain.handle('settings:get', () => ({ theme: 'light' }))
  ipcMain.handle('settings:set', () => ({}))
  ipcMain.handle('notes:list', () => [
    { id: 'a', title: '周末计划', preview: '去公园散步，买一束向日葵，读完第三章…', updatedAt: Date.now() - 3600e3, pinned: true, color: 'green' },
    { id: 'b', title: '购物清单', preview: '牛奶、鸡蛋、全麦面包、牛油果', updatedAt: Date.now() - 7200e3, pinned: false, color: 'yellow' },
    { id: 'c', title: '灵感记录', preview: '把书签做成一座小小的图书馆，每一页都住在风景里。', updatedAt: Date.now() - 86400e3, pinned: false, color: 'blue' }
  ])
  ipcMain.handle('note:read', () => ({
    id: 'demo', title: '周末计划',
    html: '<h2>周末计划</h2><p>去<strong>公园</strong>散步，买一束向日葵。</p><ul><li class="checkbox checked">读完第三章</li><li class="checkbox">整理书桌</li></ul><blockquote>慢慢来，比较快。</blockquote>',
    pinned: true, color: 'green'
  }))
  ipcMain.handle('note:save', (_e, id, p) => p)
  ipcMain.handle('note:create', () => 'x')
  ipcMain.handle('window:get-bounds', () => ({}))
  ipcMain.on('window:set-always-on-top', () => {})
  ipcMain.on('window:minimize', () => {})
  ipcMain.on('window:close', () => {})
  ipcMain.on('window:set-bounds', () => {})

  const base = {
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  }

  // 1. 列表窗口（与 createListWindow 相同参数）
  const listWin = new BrowserWindow({ ...base, width: 420, height: 640 })
  await listWin.loadFile(path.join(__dirname, 'frontend', 'dist', 'list', 'index.html'))
  await new Promise((r) => setTimeout(r, 600))
  const img1 = await listWin.webContents.capturePage()
  require('fs').writeFileSync(path.join(__dirname, 'shot-list.png'), img1.toPNG())

  // 2. 便笺窗口（与 createNoteWindow 相同参数）
  const noteWin = new BrowserWindow({ ...base, width: 360, height: 300 })
  await noteWin.loadFile(path.join(__dirname, 'frontend', 'dist', 'note', 'index.html'), { query: { id: 'demo' } })
  await new Promise((r) => setTimeout(r, 600))
  const img2 = await noteWin.webContents.capturePage()
  require('fs').writeFileSync(path.join(__dirname, 'shot-note.png'), img2.toPNG())

  console.log('SCREENSHOTS DONE')
  app.exit(0)
})
