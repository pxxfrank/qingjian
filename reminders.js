// 提醒核心逻辑（纯 Node，无 Electron 依赖，可独立单测：node tests/reminders.test.js）
// 数据模型 note.remind: Reminder[]
// { id, at（下一次触发的绝对 epoch ms）, repeat: 'once'|'daily'|'weekly'|'weekdays',
//   anchorText: string|null（本阶段恒为 null，保留字段备用）, done: boolean, lastFired: number|null }

const WEEKEND = new Set([0, 6]) // 周日=0、周六=6

function isWeekend(date) {
  return WEEKEND.has(date.getDay())
}

// 本地日历推进：返回 base 之后 n 天的同一「本地时刻」。
// 用 setDate 逐日推进（而非 +86400000），跨夏令时按本地墙钟走，时/分/秒不漂移。
function addLocalDays(base, n) {
  const d = new Date(base.getTime())
  d.setDate(d.getDate() + n)
  return d
}

// 下一次触发的绝对时刻（ms）。
// - once：返回 rem.at
// - 周期：从 rem.at 起按周期推进到「严格大于 from」的第一个时刻；
//   若 from 早于 rem.at，则直接返回 rem.at（不回溯到更早的周期）
function nextFireAt(rem, from) {
  const at = rem.at
  if (rem.repeat === 'once') return at
  if (at > from) return at
  const base = new Date(at)
  if (rem.repeat === 'daily') {
    let d = base
    do { d = addLocalDays(d, 1) } while (d.getTime() <= from)
    return d.getTime()
  }
  if (rem.repeat === 'weekly') {
    let d = base
    do { d = addLocalDays(d, 7) } while (d.getTime() <= from)
    return d.getTime()
  }
  if (rem.repeat === 'weekdays') {
    let d = base
    do { d = addLocalDays(d, 1) } while (d.getTime() <= from || isWeekend(d))
    return d.getTime()
  }
  return at // 未知 repeat：按一次性对待（不无限推进）
}

// 是否到点：未完成且已到达触发时刻
function isDue(rem, now) {
  return !rem.done && typeof rem.at === 'number' && rem.at <= now
}

// 触发一次后的新 rem：
// - once：标记 done，记录 lastFired
// - 周期：把 at 推进到未来一期（错过多期只前进一期，不补发），记录 lastFired
function advance(rem, now) {
  if (rem.repeat === 'once') return { ...rem, done: true, lastFired: now }
  return { ...rem, at: nextFireAt(rem, now), lastFired: now }
}

module.exports = { nextFireAt, isDue, advance }
