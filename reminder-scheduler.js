// 提醒调度器（主进程接线）：纯逻辑下沉到 reminders.js，本模块只管定时与触发。
// - 单次 setTimeout 上限约 24.8 天（< 2^31 ms），故用 maxHorizon 分片 + 到期重算；
// - 时间源 / 定时器可注入，便于纯 Node 单测（见 tests/reminders.test.js）。
const reminders = require('./reminders')

const ONCE_OVERDUE_SILENT_MS = 86400000 // once 逾期超过 1 天：静默标 done、不发通知
const OVERDUE_NOTICE_MS = 60000          // 逾期超过该阈值才在通知文案标注「（已过期）」

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function createReminderScheduler(opts = {}) {
  const store = opts.store
  const openNote = opts.openNote || (() => {}) // notify 缺省时的兜底：至少把便笺唤到前台
  const notify = opts.notify || ((id) => openNote(id))
  const maxHorizonMs = typeof opts.maxHorizonMs === 'number' ? opts.maxHorizonMs : 6 * 60 * 60 * 1000
  const heartbeatMs = typeof opts.heartbeatMs === 'number' ? opts.heartbeatMs : 60000
  const nowFn = opts.now || Date.now
  const setTimer = opts.setTimeout || setTimeout
  const clearTimer = opts.clearTimeout || clearTimeout
  const setLoop = opts.setInterval || setInterval
  const clearLoop = opts.clearInterval || clearInterval

  let timer = null
  let heartbeat = null
  let running = false

  // 最早一个「未完成」提醒（无则 null）
  function earliest() {
    let best = null
    for (const item of store.listReminders()) {
      const rem = item.rem
      if (!rem || rem.done || typeof rem.at !== 'number') continue
      if (!best || rem.at < best.rem.at) best = item
    }
    return best
  }

  // 按最早提醒重排定时器：延迟夹取到 [0, maxHorizon]，避免超长 setTimeout 溢出
  function armTimer() {
    if (timer) { clearTimer(timer); timer = null }
    const item = earliest()
    if (!item) return // 空集合：不设定时器，也不告警
    const delay = clamp(item.rem.at - nowFn(), 0, maxHorizonMs)
    timer = setTimer(onTimer, delay)
    if (timer && typeof timer.unref === 'function') timer.unref()
  }

  function onTimer() {
    timer = null
    fireDue()
  }

  // 触发所有已到期的未完成提醒（同一时刻可能有多个），随后重排定时器
  function fireDue() {
    const t = nowFn()
    for (const item of store.listReminders()) {
      const rem = item.rem
      if (!rem || rem.done || !reminders.isDue(rem, t)) continue
      fire(item.id, rem, t)
    }
    armTimer()
  }

  // 触发一次：先 advance 写回，再通知；
  // once 逾期 > 1 天：只静默标 done（advance 已完成），不发通知
  function fire(id, rem, t) {
    store.setReminder(id, reminders.advance(rem, t))
    if (rem.repeat === 'once' && t - rem.at > ONCE_OVERDUE_SILENT_MS) return
    const overdue = t - rem.at > OVERDUE_NOTICE_MS
    notify(id, rem, { overdue }) // 传触发时的 rem（含到期时刻），供文案使用
  }

  function rescan() {
    armTimer()
  }

  // 立即重排 + 心跳兜底（休眠/漏触发后靠它补齐）
  function start() {
    if (running) return
    running = true
    rescan()
    heartbeat = setLoop(rescan, heartbeatMs)
    if (heartbeat && typeof heartbeat.unref === 'function') heartbeat.unref()
  }

  function stop() {
    running = false
    if (timer) { clearTimer(timer); timer = null }
    if (heartbeat) { clearLoop(heartbeat); heartbeat = null }
  }

  return { start, stop, rescan }
}

module.exports = { createReminderScheduler, ONCE_OVERDUE_SILENT_MS }
