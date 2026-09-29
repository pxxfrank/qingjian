// 今日看板构造逻辑单元测试（纯 Node，直接跑：node tests/today.test.js）
const fs = require('fs')
const os = require('os')
const path = require('path')
const { buildToday, localDayRange } = require('../today')
const { createNoteIndex } = require('../note-index')
const { createStore } = require('../store')

let pass = 0
let fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name) }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  => ' + extra : '')) }
}

// 固定「今天」= 2026-01-15 本地，避免跨天/时区抖动
const now = new Date(2026, 0, 15, 12, 0, 0).getTime()
const at = (y, mo, d, h, mi = 0) => new Date(y, mo, d, h, mi, 0).getTime()

// ---------- localDayRange ----------
console.log('\n[today] localDayRange')
const range = localDayRange(now)
ok('start = 当日 00:00（本地）', range.start === new Date(2026, 0, 15, 0, 0, 0).getTime(), range.start)
ok('end = 次日 00:00（本地）', range.end === new Date(2026, 0, 16, 0, 0, 0).getTime(), range.end)

// ---------- buildToday ----------
console.log('\n[today] buildToday 分组')
const notes = [
  { id: 'a', title: '有任务', color: 'green', html: '<ul><li class="checkbox">买菜</li><li class="checkbox checked">已完成</li><li class="checkbox">遛狗</li></ul>' },
  {
    id: 'b',
    title: '有提醒',
    html: '<p>无任务</p>',
    remind: [
      { id: 'r1', at: at(2026, 0, 15, 9), repeat: 'daily', done: false, text: '晨会' },
      { id: 'r2', at: at(2026, 0, 15, 23), repeat: 'once', done: true }, // 已完成
      { id: 'r3', at: at(2026, 0, 16, 8), repeat: 'once', done: false } // 明天
    ]
  },
  { id: 'c', title: '空', html: '<p>无</p>' },
  { id: 'd', color: 'blue', html: '<ul><li class="checkbox">x</li></ul>' }
]
const out = buildToday(notes, { now })
ok('仅返回 tasks / reminders 非空的便笺', out.map((g) => g.id).join(',') === 'a,b,d', JSON.stringify(out.map((g) => g.id)))

const ga = out.find((g) => g.id === 'a')
ok('tasks 仅保留未勾选项且 index/text 正确',
  ga.tasks.length === 2 && ga.tasks[0].index === 0 && ga.tasks[0].text === '买菜' &&
  ga.tasks[1].index === 2 && ga.tasks[1].text === '遛狗', JSON.stringify(ga.tasks))
ok('分组含 id/title/color', ga.title === '有任务' && ga.color === 'green')

const gb = out.find((g) => g.id === 'b')
ok('reminders 仅保留今天未完成项', gb.reminders.length === 1 && gb.reminders[0].at === at(2026, 0, 15, 9) && gb.reminders[0].repeat === 'daily', JSON.stringify(gb.reminders))
ok('reminders 保留可选 text', gb.reminders[0].text === '晨会', JSON.stringify(gb.reminders[0]))
ok('无任务便笺的 tasks 为空数组', gb.tasks.length === 0)

const gd = out.find((g) => g.id === 'd')
ok('缺省 title 为空串 / color 缺省 yellow', gd.title === '' && gd.color === 'blue')
ok('默认 color 为 yellow', buildToday([{ id: 'z', html: '<ul><li class="checkbox">t</li></ul>' }], { now })[0].color === 'yellow')
ok('缺省 title 为空串', buildToday([{ id: 'z2', html: '<ul><li class="checkbox">t</li></ul>' }], { now })[0].title === '')

// ---------- 今天区间边界 ----------
console.log('\n[today] 今天区间边界')
ok('at = 今日 00:00 计入', buildToday([{ id: 'e1', html: '', remind: [{ id: 'x', at: at(2026, 0, 15, 0), repeat: 'once', done: false }] }], { now }).length === 1)
ok('at = 次日 00:00 不计入', buildToday([{ id: 'e2', html: '', remind: [{ id: 'x', at: at(2026, 0, 16, 0), repeat: 'once', done: false }] }], { now }).length === 0)
ok('at < 昨日 23:59 不计入', buildToday([{ id: 'e3', html: '', remind: [{ id: 'x', at: at(2026, 0, 14, 23, 59), repeat: 'once', done: false }] }], { now }).length === 0)
ok('at 缺失 / 非数字不计入', buildToday([{ id: 'e4', html: '', remind: [{ id: 'x', repeat: 'once', done: false }] }], { now }).length === 0)

// ---------- 派生缓存路径 ----------
console.log('\n[today] 派生缓存（note-index）路径')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-md-today-'))
const store = createStore(path.join(tmp, 'notes'), path.join(tmp, 'settings.json'))
store.writeNote('idx', { title: 'T', color: 'blue', html: '<ul><li class="checkbox">一</li><li class="checkbox checked">二</li></ul>' })
const index = createNoteIndex(store)
const viaIndex = buildToday(store.readAllNotes(), { index, now })
ok('index 派生缓存结果与直接解析一致', viaIndex.length === 1 && viaIndex[0].tasks.length === 1 && viaIndex[0].tasks[0].text === '一', JSON.stringify(viaIndex))

// ---------- 健壮性 ----------
console.log('\n[today] 健壮性')
ok('notes 为空 / null 安全', buildToday(null).length === 0 && buildToday([]).length === 0)
ok('跳过无 id / null 元素', buildToday([null, {}, { id: 'k', html: '<ul><li class="checkbox">ok</li></ul>' }], { now }).length === 1)

console.log(`\n[today] ${pass} passed, ${fail} failed`)
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(fail === 0 ? 0 : 1)
