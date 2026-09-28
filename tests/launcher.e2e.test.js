// 贴边启动器控制器测试（注入光标/焦点/工作区，确定性驱动，不依赖真实鼠标）
module.exports = {
  name: 'launcher',
  run: async (h) => {
    const { ok, sleep } = h
    const { BrowserWindow } = require('electron')
    const { createLauncher } = require('../launcher')
    const G = require('../launcher-geometry')

    const wa = { x: 0, y: 0, width: 1200, height: 800 }
    let cursor = { x: 500, y: 400 }
    let focused = false

    const win = new BrowserWindow({ width: 56, height: 56, frame: false, transparent: true, show: false })
    const L = createLauncher(win, {
      edge: 'right',
      count: 3,
      pollInterval: 100000, // 关掉自动轮询，测试里手动 step()
      expandDelay: 0,
      collapseDelay: 80,
      getCursor: () => cursor,
      getWorkArea: () => wa,
      isFocused: () => focused
    })

    console.log('\n[launcher] 常驻小球 / 悬停展开 / 收回')
    ok('初始不可见（等待 show）', L.visible === false)
    L.show()
    ok('显示 → 收起为半个小球', L.visible === true && win.getBounds().x === 1200 - G.WIN_R && win.getBounds().width === G.ballSize(), JSON.stringify(win.getBounds()))

    cursor = { x: 1192, y: 400 }
    L.step()
    await sleep(20)
    ok('悬停小球 → 展开成横条', L.expanded === true && win.getBounds().x === 1200 - G.barWidth(3), JSON.stringify(win.getBounds()))

    focused = false
    cursor = { x: 500, y: 400 }
    L.step()
    await sleep(140)
    ok('鼠标移开 → 收回小球', L.expanded === false && win.getBounds().x === 1200 - G.WIN_R, JSON.stringify(win.getBounds()))

    cursor = { x: 1192, y: 400 }
    L.step()
    await sleep(20)
    ok('再次悬停展开', L.expanded === true)
    focused = true
    cursor = { x: 500, y: 400 }
    L.step()
    await sleep(140)
    ok('聚焦中鼠标移开不收回', L.expanded === true, JSON.stringify(win.getBounds()))
    focused = false

    console.log('\n[launcher] 图标数 / 纵向拖动 / 左右换边 / 锚点')
    L.setCount(5)
    ok('图标数变化 → 横条变宽', L.count === 5 && win.getBounds().width === G.barWidth(5), JSON.stringify(win.getBounds()))

    L.dragStart(900, 400)
    L.dragMove(900, 280)
    ok('拖动 → 纵向位置更新', Math.round(L.getY()) === 280 && win.getBounds().y === 280 - G.BAR_H / 2, JSON.stringify(win.getBounds()))
    L.dragMove(300, 280)
    ok('拖到左半屏 → 切到贴左边', L.edge === 'left' && win.getBounds().x === 0, JSON.stringify(win.getBounds()))
    L.dragMove(900, 260)
    ok('拖回右半屏 → 切回贴右边', L.edge === 'right' && win.getBounds().x === 1200 - G.barWidth(5), JSON.stringify(win.getBounds()))
    L.dragEnd()
    ok('锚点＝贴边屏幕边缘 + 纵向中心', L.getAnchor().x === 1200 && L.getAnchor().y === 260, JSON.stringify(L.getAnchor()))

    L.setEdge('left')
    ok('setEdge 左 → 收起小球贴左缘', win.getBounds().x === -G.WIN_R && L.expanded === false, JSON.stringify(win.getBounds()))
    cursor = { x: 2, y: 260 }
    L.step()
    await sleep(20)
    ok('悬停左缘小球 → 展开', L.expanded === true && win.getBounds().x === 0, JSON.stringify(win.getBounds()))

    L.destroy()
    win.destroy()
  }
}
