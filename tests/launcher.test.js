// 贴边启动器几何单元测试（纯 Node，直接跑：node tests/launcher.test.js）
const G = require('../launcher-geometry')

let pass = 0
let fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name) }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  => ' + extra : '')) }
}

const wa = { x: 0, y: 0, width: 1200, height: 800 }

// 1. 小球：窗口中心压在屏幕边缘
const br = G.ballBounds(wa, 'right', 400)
ok('右贴边小球：窗口中心在屏幕右缘', br.x === 1200 - G.WIN_R && br.width === G.ballSize(), JSON.stringify(br))
ok('右贴边小球：纵向按 y 居中', br.y === 400 - G.WIN_R, JSON.stringify(br))
ok('小球窗口含透明留白（放得下投影）', G.WIN_R - G.BALL_R === G.MARGIN && G.MARGIN >= 8)
const bl = G.ballBounds(wa, 'left', 400)
ok('左贴边小球：窗口中心在屏幕左缘', bl.x === -G.WIN_R, JSON.stringify(bl))
const bTop = G.ballBounds(wa, 'right', 0)
ok('小球纵向夹取到工作区顶部', bTop.y === 0, JSON.stringify(bTop))
const bBottom = G.ballBounds(wa, 'right', 800)
ok('小球纵向夹取到工作区底部', bBottom.y === 800 - G.WIN_R * 2, JSON.stringify(bBottom))

// 2. 横条宽度随图标数量增长
ok('横条宽度（1 个图标）', G.barWidth(1) === G.PAD * 2 + G.BTN, G.barWidth(1))
ok('横条宽度（3 个图标）', G.barWidth(3) === G.PAD * 2 + 3 * G.BTN + 2 * G.GAP, G.barWidth(3))

// 3. 横条：贴齐屏幕内边缘
const bar = G.barBounds(wa, 'right', 400, 3)
ok('右贴边横条贴齐右缘', bar.x === 1200 - G.barWidth(3) && bar.width === G.barWidth(3), JSON.stringify(bar))
ok('横条高度固定且纵向居中', bar.height === G.BAR_H && bar.y === 400 - G.BAR_H / 2, JSON.stringify(bar))
ok('左贴边横条贴齐左缘', G.barBounds(wa, 'left', 400, 3).x === 0)
const many = G.barBounds(wa, 'right', 400, 100)
ok('横条超宽时封顶不溢出屏幕', many.width <= wa.width - 16 && many.x >= wa.x, JSON.stringify(many))

// 4. 小球鼠标热区
const reveal = G.ballReveal(wa, 'right', br)
ok('右贴边热区位于屏幕右缘', reveal.x === 1200 - (G.WIN_R + 8) && reveal.width === G.WIN_R + 8, JSON.stringify(reveal))
ok('左贴边热区位于屏幕左缘', G.ballReveal(wa, 'left', bl).x === 0)

// 5. 垂直中心夹取（小球与横条都要在工作区内）
ok('clampCenterY 顶部夹取', G.clampCenterY(wa, -100) === G.WIN_R)
ok('clampCenterY 底部夹取', G.clampCenterY(wa, 1000) === 800 - G.WIN_R)
ok('clampCenterY 区间内原样', G.clampCenterY(wa, 400) === 400)

// 6. 命中判定
ok('pointInRect 内部为真', G.pointInRect({ x: 1190, y: 400 }, reveal) === true)
ok('pointInRect 外部为假', G.pointInRect({ x: 100, y: 400 }, reveal) === false)
ok('pointInBounds 容差内为真', G.pointInBounds({ x: bar.x - 8, y: bar.y }, bar, 14) === true)
ok('pointInBounds 容差外为假', G.pointInBounds({ x: 100, y: bar.y }, bar, 14) === false)

console.log(`\n[launcher] ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
