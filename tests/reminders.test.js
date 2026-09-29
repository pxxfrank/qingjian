// 提醒功能单元测试（纯 Node，直接跑：node tests/reminders.test.js）
// 覆盖 reminders.js 的 nextFireAt / isDue / advance，以及 reminder-scheduler.js 的定时与触发。
const fs = require('fs')
const os = require('os')
const path = require('path')
const { nextFireAt, isDue, advance } = require('../reminders')
const { createReminderScheduler } = require('../reminder-scheduler')
const { createStore } = require('../store')

let pass = 0
let fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name) }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  => ' + extra : '')) }
}

const at = (y, mo, d, h = 0, mi = 0, s = 0) => new Date(y, mo, d, h, mi, s).getTime()
const parts = (t) => {
  const d = new Date(t)
  return { y: d.getFullYear(), mo: d.getMonth(), d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds(), w: d.getDay() }
}
const sameClock = (t, ref) => {
  const a = new Date(t); const b = new Date(ref)
  return a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes() && a.getSeconds() === b.getSeconds()
}

// ---------- nextFireAt ----------
console.log('\n[reminders] nextFireAt')
const once = { id: 'a', at: at(2026, 0, 15, 9, 0), repeat: 'once', anchorText: null, done: false, lastFired: null }
ok('once 始终返回 at', nextFireAt(once, at(2025, 0, 1)) === once.at && nextFireAt(once, at(2027, 0, 1)) === once.at)

const daily = { id: 'd', at: at(2026, 0, 15, 9, 0), repeat: 'daily', anchorText: null, done: false, lastFired: null }
ok('daily：from 早于 at 时返回 at', nextFireAt(daily, at(2026, 0, 15, 8, 0)) === daily.at)
ok('daily：from 等于 at 时推进到次日（严格大于）', nextFireAt(daily, daily.at) === at(2026, 0, 16, 9, 0))
ok('daily：from 晚于 at 时推进到次日同一时刻', nextFireAt(daily, at(2026, 0, 15, 10, 0)) === at(2026, 0, 16, 9, 0))
ok('daily：跨月正确（1/31 → 2/1）', nextFireAt({ ...daily, at: at(2026, 0, 31, 8, 30) }, at(2026, 0, 31, 8, 30)) === at(2026, 1, 1, 8, 30))
ok('daily：跨年正确（12/31 → 1/1）', nextFireAt({ ...daily, at: at(2026, 11, 31, 23, 0) }, at(2026, 11, 31, 23, 0)) === at(2027, 0, 1, 23, 0))
ok('daily：错过多期只前进到未来一期', nextFireAt(daily, at(2026, 0, 20, 10, 0)) === at(2026, 0, 21, 9, 0))
ok('daily：保留分/秒（本地时刻不变）', sameClock(nextFireAt({ ...daily, at: at(2026, 2, 1, 7, 45, 30) }, at(2026, 2, 1, 7, 45, 30)), at(2026, 2, 2, 7, 45, 30)))

const weekly = { id: 'w', at: at(2026, 0, 15, 9, 0), repeat: 'weekly', anchorText: null, done: false, lastFired: null }
ok('weekly：from 早于 at 时返回 at', nextFireAt(weekly, at(2026, 0, 14)) === weekly.at)
ok('weekly：推进 +7 天同一时刻', nextFireAt(weekly, weekly.at) === at(2026, 0, 22, 9, 0))
ok('weekly：错过两周只前进一期', nextFireAt(weekly, at(2026, 0, 30, 12, 0)) === at(2026, 1, 5, 9, 0))

const weekdays = { id: 'k', at: at(2026, 0, 16, 9, 0), repeat: 'weekdays', anchorText: null, done: false, lastFired: null }
ok('weekdays：from 早于 at 时返回 at', nextFireAt(weekdays, at(2026, 0, 15)) === weekdays.at)
const friNext = nextFireAt(weekdays, weekdays.at) // 周五 → 跳过周六周日 → 周一
ok('weekdays：周五下一期跳到周一', friNext === at(2026, 0, 19, 9, 0))
ok('weekdays：结果落在工作日', parts(friNext).w >= 1 && parts(friNext).w <= 5)
const thu = { ...weekdays, at: at(2026, 0, 15, 9, 0) }
ok('weekdays：周四下一期为周五', nextFireAt(thu, thu.at) === at(2026, 0, 16, 9, 0))
ok('weekdays：跨周末只推一期（周四 10:00 已过 → 周五）', nextFireAt(thu, at(2026, 0, 15, 10, 0)) === at(2026, 0, 16, 9, 0))

// ---------- isDue ----------
console.log('\n[reminders] isDue')
ok('到点且未完成 → true', isDue({ at: 1000, done: false }, 1000) === true)
ok('已过点未完成 → true', isDue({ at: 1000, done: false }, 2000) === true)
ok('未到点 → false', isDue({ at: 3000, done: false }, 2000) === false)
ok('已完成 → false', isDue({ at: 1000, done: true }, 2000) === false)

// ---------- advance ----------
console.log('\n[reminders] advance')
const now = at(2026, 0, 15, 9, 0)
const advOnce = advance({ ...once, at: now - 1000 }, now)
ok('once：标记 done 且记录 lastFired', advOnce.done === true && advOnce.lastFired === now)
const advDaily = advance({ ...daily, at: now - 1000 }, now)
ok('周期：推进到未来一期', advDaily.at > now && advDaily.lastFired === now && advDaily.done === false)
ok('周期：只推进一期（<= 一个周期）', advDaily.at - now <= 86400000)
const advMiss = advance({ ...daily, at: at(2026, 0, 10, 9, 0) }, now)
ok('周期：错过多期只推一期（> now 且 <= now+周期）', advMiss.at > now && advMiss.at - now <= 86400000)
const advWk = advance({ ...weekdays, at: now - 1000 }, now)
ok('weekdays：推进到最近工作日', advWk.at > now && parts(advWk.at).w >= 1 && parts(advWk.at).w <= 5)

// ---------- reminder-scheduler ----------
console.log('\n[reminders] reminder-scheduler')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-md-remind-'))
const store = createStore(path.join(tmp, 'notes'), path.join(tmp, 'settings.json'))

const NOW = at(2026, 0, 15, 9, 0, 0)
let scheduled = null
const fakeSetTimeout = (fn, delay) => { scheduled = { fn, delay }; return { unref() {} } }
const fakeClearTimeout = () => { scheduled = null }
const notified = []
const sched = createReminderScheduler({
  store,
  notify: (id, rem, meta) => notified.push({ id, rem, meta }),
  now: () => NOW,
  setTimeout: fakeSetTimeout,
  clearTimeout: fakeClearTimeout
})

// 到期（once，逾期 <= 1 天）
store.writeNote('s-due', { title: '到期' })
store.setReminder('s-due', { id: 'r1', at: NOW - 10 * 60e3, repeat: 'once', anchorText: null, done: false, lastFired: null })
sched.rescan()
ok('已到期提醒延迟夹取为 0', scheduled && scheduled.delay === 0, JSON.stringify(scheduled && scheduled.delay))
scheduled.fn()
ok('到点后发一次通知', notified.length === 1 && notified[0].id === 's-due', JSON.stringify(notified))
ok('once 逾期（<=1 天）通知带 overdue 标记', notified[0].meta && notified[0].meta.overdue === true)
ok('once 触发后标记 done', store.getReminder('s-due', 'r1').done === true)

// 未来提醒 → 按差值定时
notified.length = 0
store.writeNote('s-future', { title: '未来' })
const FUT = NOW + 3600e3
store.setReminder('s-future', { id: 'r2', at: FUT, repeat: 'daily', anchorText: null, done: false, lastFired: null })
sched.rescan()
ok('未来提醒延迟 = at - now', scheduled && scheduled.delay === 3600e3, JSON.stringify(scheduled && scheduled.delay))

// 长周期提醒 → 延迟被 maxHorizon 夹取（不超单次 setTimeout 上限）
store.removeReminder('s-future', 'r2') // 清掉上一个未来提醒，让“最远”提醒成为候选
let scheduled2 = null
const schedH = createReminderScheduler({
  store,
  notify: () => {},
  now: () => NOW,
  maxHorizonMs: 6 * 60 * 60 * 1000,
  setTimeout: (fn, delay) => { scheduled2 = { fn, delay }; return { unref() {} } },
  clearTimeout: () => { scheduled2 = null }
})
store.writeNote('s-far', { title: '远' })
store.setReminder('s-far', { id: 'r3', at: NOW + 30 * 86400000, repeat: 'once', anchorText: null, done: false, lastFired: null })
schedH.rescan()
ok('超长延迟被 maxHorizon 夹取', scheduled2 && scheduled2.delay === 6 * 60 * 60 * 1000, JSON.stringify(scheduled2 && scheduled2.delay))

// once 逾期 > 1 天：静默标 done、不发通知
notified.length = 0
store.writeNote('s-old', { title: '很久以前' })
store.setReminder('s-old', { id: 'r4', at: NOW - 2 * 86400000, repeat: 'once', anchorText: null, done: false, lastFired: null })
sched.rescan()
scheduled.fn()
ok('once 逾期 > 1 天静默标 done', store.getReminder('s-old', 'r4').done === true)
ok('once 逾期 > 1 天不发通知', notified.length === 0, JSON.stringify(notified))

// 周期提醒到点 → 推进且发通知
notified.length = 0
store.writeNote('s-repeat', { title: '每天' })
store.setReminder('s-repeat', { id: 'r5', at: NOW - 1000, repeat: 'daily', anchorText: null, done: false, lastFired: null })
sched.rescan()
scheduled.fn()
const r5 = store.getReminder('s-repeat', 'r5')
ok('周期提醒触发后推进到未来且未完成', r5 && r5.done === false && r5.at > NOW, JSON.stringify(r5))
ok('周期提醒触发后发通知', notified.some((x) => x.id === 's-repeat'))

// 空集合：不安排定时器、不抛错
const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-md-remind-empty-'))
const emptyStore = createStore(path.join(emptyDir, 'notes'), path.join(emptyDir, 'settings.json'))
let scheduled3 = null
const schedEmpty = createReminderScheduler({
  store: emptyStore,
  notify: () => {},
  now: () => NOW,
  setTimeout: (fn, delay) => { scheduled3 = { fn, delay }; return { unref() {} } },
  clearTimeout: () => { scheduled3 = null }
})
let threw = false
try { schedEmpty.rescan() } catch { threw = true }
ok('空集合 rescan 不抛错且不安排定时器', threw === false && scheduled3 === null)

sched.stop()
schedH.stop()
schedEmpty.stop()

console.log(`\n[reminders] ${pass} passed, ${fail} failed`)
fs.rmSync(tmp, { recursive: true, force: true })
fs.rmSync(emptyDir, { recursive: true, force: true })
process.exit(fail === 0 ? 0 : 1)
