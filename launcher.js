// 贴边启动器 · 窗口控制器（主进程）
// 收起 = 边缘半个小球；鼠标移上小球 → 展开成扁长横条；鼠标移开 → 收回小球。
// 可见性（是否显示小球）由调用方控制：仅当有窗口被「收起到贴边」时才显示。
const G = require('./launcher-geometry')

// 延迟获取 screen：main.js 在 app ready 之前 require 本模块，此时访问 electron.screen 会报错
function screenModule() {
  return require('electron').screen
}

function normalizeEdge(mode) {
  return mode === 'left' ? 'left' : 'right'
}

function createLauncher(win, options = {}) {
  const opts = {
    pollInterval: options.pollInterval || 100,
    collapseDelay: options.collapseDelay || 350, // 鼠标移开后延迟收回
    expandDelay: options.expandDelay == null ? 120 : options.expandDelay, // 悬停后延迟展开（让小球先高亮）
    leaveMargin: options.leaveMargin == null ? 14 : options.leaveMargin,
    // 以下均可注入，便于测试
    getCursor: options.getCursor || (() => screenModule().getCursorScreenPoint()),
    getWorkArea: options.getWorkArea || (() => screenModule().getDisplayMatching(win.getBounds()).workArea),
    isFocused: options.isFocused || (() => win.isFocused())
  }

  let edge = normalizeEdge(options.edge)
  let count = Math.max(1, options.count || 1)
  let expanded = false
  let visible = false
  let yCenter = typeof options.y === 'number' ? options.y : null // null → 工作区垂直居中
  let dragging = false
  let grabOffset = 0

  let pollTimer = null
  let collapseTimer = null
  let expandTimer = null
  let destroyed = false

  function centerY(wa) {
    return yCenter == null ? wa.y + wa.height / 2 : yCenter
  }
  function clampedY(wa) {
    return G.clampCenterY(wa, centerY(wa))
  }
  function ballRect() {
    const wa = opts.getWorkArea()
    return G.ballBounds(wa, edge, clampedY(wa))
  }
  function barRect() {
    const wa = opts.getWorkArea()
    return G.barBounds(wa, edge, clampedY(wa), count)
  }

  function notify() {
    if (destroyed || win.isDestroyed()) return
    win.webContents.send('launcher:state', { expanded, edge, count, visible })
  }

  function applyCurrent() {
    if (destroyed || win.isDestroyed()) return
    win.setBounds(expanded ? barRect() : ballRect())
  }

  function clearCollapse() {
    clearTimeout(collapseTimer)
    collapseTimer = null
  }
  function clearExpand() {
    clearTimeout(expandTimer)
    expandTimer = null
  }
  function scheduleCollapse() {
    if (collapseTimer) return
    collapseTimer = setTimeout(() => {
      collapseTimer = null
      collapse()
    }, opts.collapseDelay)
  }
  function scheduleExpand() {
    if (expandTimer) return
    expandTimer = setTimeout(() => {
      expandTimer = null
      expand()
    }, opts.expandDelay)
  }

  function expand() {
    if (destroyed || !visible || expanded) return
    expanded = true
    win.setBounds(barRect())
    notify()
  }

  function collapse() {
    if (destroyed || !expanded) return
    expanded = false
    win.setBounds(ballRect())
    notify()
  }

  // 轮询一次：决定展开还是收回
  function step() {
    if (destroyed || !visible || dragging) return
    const wa = opts.getWorkArea()
    const cursor = opts.getCursor()
    if (!expanded) {
      if (G.pointInRect(cursor, G.ballReveal(wa, edge, G.ballBounds(wa, edge, clampedY(wa))))) scheduleExpand()
      else clearExpand()
    } else if (!opts.isFocused() && !G.pointInBounds(cursor, win.getBounds(), opts.leaveMargin)) {
      scheduleCollapse()
    } else {
      clearCollapse()
    }
  }

  function start() {
    if (!pollTimer) pollTimer = setInterval(step, opts.pollInterval)
  }
  function stop() {
    clearInterval(pollTimer)
    pollTimer = null
  }

  function setEdge(mode) {
    edge = normalizeEdge(mode)
    clearExpand()
    clearCollapse()
    if (visible) {
      expanded = false
      win.setBounds(ballRect())
    }
    notify()
  }

  function setCount(n) {
    count = Math.max(1, n)
    if (visible && expanded) win.setBounds(barRect())
    notify()
  }

  // 显示小球（常驻）
  function show() {
    if (destroyed || win.isDestroyed()) return
    if (!visible) {
      visible = true
      expanded = false
      win.setBounds(ballRect())
      if (!win.isVisible()) win.showInactive()
      start()
    }
    notify()
  }

  function dragStart(screenX, screenY) {
    if (destroyed || !visible) return
    dragging = true
    grabOffset = screenY - clampedY(opts.getWorkArea())
    clearExpand()
    clearCollapse()
  }
  function dragMove(screenX, screenY) {
    if (destroyed || !dragging) return
    const wa = opts.getWorkArea()
    const newEdge = screenX < wa.x + wa.width / 2 ? 'left' : 'right'
    const edgeChanged = newEdge !== edge
    if (edgeChanged) edge = newEdge
    yCenter = G.clampCenterY(wa, screenY - grabOffset)
    applyCurrent()
    if (edgeChanged) notify()
  }
  function dragEnd() {
    dragging = false
  }

  // 小球在世界坐标里的锚点（贴边侧屏幕边缘、启动器垂直中心）——供「收起到小球」动画定位
  function getAnchor() {
    const wa = opts.getWorkArea()
    return { x: edge === 'left' ? wa.x : wa.x + wa.width, y: clampedY(wa) }
  }

  function setY(y) {
    yCenter = y
    if (visible) applyCurrent()
  }
  function getY() {
    return yCenter
  }

  return {
    get edge() { return edge },
    get expanded() { return expanded },
    get count() { return count },
    get visible() { return visible },
    setEdge,
    setCount,
    show,
    dragStart,
    dragMove,
    dragEnd,
    setY,
    getY,
    getAnchor,
    expand,
    collapse,
    step,
    start,
    stop,
    destroy() {
      destroyed = true
      stop()
      clearExpand()
      clearCollapse()
    }
  }
}

module.exports = { createLauncher }
