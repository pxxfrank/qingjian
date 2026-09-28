// 贴边启动器 · 纯几何计算（无 Electron 依赖，可独立单测）
// 收起 = 小球（窗口中心落在屏幕边缘上，只露出半个球）；展开 = 扁长横条。

const BALL_R = 20 // 小球可视半径（MD3 small FAB 40dp）
const MARGIN = 18 // 窗口内透明留白：给投影与捕获涟漪留空间，避免被窗口矩形裁成方块
const WIN_R = BALL_R + MARGIN // 38 → 收起窗口 76×76
const BAR_H = 56 // 横条高度（MD3 顶栏/工具栏高度）
const BTN = 40 // 图标按钮边长（MD3 standard icon button）
const GAP = 6 // 图标间距
const PAD = 8 // 横条左右内边距

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function ballSize() {
  return WIN_R * 2
}

// 收起：窗口中心压在屏幕边缘 → 一半在屏外，露出半个球
function ballBounds(wa, edge, y) {
  const cy = clamp(y, wa.y + WIN_R, wa.y + wa.height - WIN_R)
  const x = edge === 'left' ? wa.x - WIN_R : wa.x + wa.width - WIN_R
  return { x: Math.round(x), y: Math.round(cy - WIN_R), width: WIN_R * 2, height: WIN_R * 2 }
}

// 横条宽度随图标数量增长
function barWidth(count) {
  const n = Math.max(1, count)
  return PAD * 2 + n * BTN + (n - 1) * GAP
}

// 展开：横条贴齐屏幕内边缘（超出屏幕宽度则封顶，由渲染层横向滚动）
function barBounds(wa, edge, y, count) {
  const maxW = Math.max(ballSize(), wa.width - 16)
  const w = Math.round(Math.min(barWidth(count), maxW))
  const h = BAR_H
  const cy = clamp(y, wa.y + h / 2, wa.y + wa.height - h / 2)
  const x = edge === 'left' ? wa.x : wa.x + wa.width - w
  return { x: Math.round(x), y: Math.round(cy - h / 2), width: w, height: h }
}

// 小球可见部分的鼠标热区（含少量外扩）
function ballReveal(wa, edge, ball, extra = 8) {
  const visibleW = WIN_R + extra
  const x = edge === 'left' ? wa.x : wa.x + wa.width - visibleW
  return { x, y: ball.y - extra, width: visibleW, height: ball.height + extra * 2 }
}

// 垂直中心点夹取：保证小球与横条都完整落在工作区内
function clampCenterY(wa, y) {
  const half = Math.max(WIN_R, BAR_H / 2)
  return clamp(y, wa.y + half, wa.y + wa.height - half)
}

function pointInRect(p, r) {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height
}

function pointInBounds(p, b, margin = 0) {
  return p.x >= b.x - margin && p.x <= b.x + b.width + margin &&
    p.y >= b.y - margin && p.y <= b.y + b.height + margin
}

module.exports = {
  BALL_R,
  MARGIN,
  WIN_R,
  BAR_H,
  BTN,
  GAP,
  PAD,
  clamp,
  ballSize,
  ballBounds,
  barWidth,
  barBounds,
  ballReveal,
  clampCenterY,
  pointInRect,
  pointInBounds
}
