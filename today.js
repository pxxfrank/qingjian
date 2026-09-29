// 今日看板：从便笺集合构造「按便笺分组」的看板数据（纯 Node，可独立单测）
// - tasks：未勾选任务项（保留 index/text）；优先取派生缓存，缺省退回解析 html
// - reminders：remind 中未完成且 at 落在本地今天的项（{ at, repeat, text? }）
// - 仅保留 tasks 或 reminders 非空的便笺
const { extractTasks } = require('./notes-parse')

// 本地「今天」区间 [start, end)：当日 00:00 ≤ at < 次日 00:00（按本地时区，非 UTC）
function localDayRange(now) {
  const d = new Date(now)
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
  return { start, end }
}

// notes：store.readAllNotes() 结果；opts.index：可选的派生缓存（note-index，需有 get(id)）；
// opts.now：可注入的当前时刻（便于测试）
function buildToday(notes, opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : Date.now()
  const index = opts.index || null
  const { start, end } = localDayRange(now)
  const out = []
  for (const note of notes || []) {
    if (!note || !note.id) continue
    const cached = index && typeof index.get === 'function' ? index.get(note.id) : null
    const allTasks = cached && Array.isArray(cached.tasks) ? cached.tasks : extractTasks(note.html || '')
    const tasks = allTasks
      .filter((t) => t && !t.checked)
      .map((t) => ({ index: t.index, text: t.text }))
    const arr = Array.isArray(note.remind) ? note.remind : []
    const reminders = []
    for (const rem of arr) {
      if (!rem || rem.done || typeof rem.at !== 'number') continue
      if (rem.at < start || rem.at >= end) continue
      const item = { at: rem.at, repeat: rem.repeat || 'once' }
      if (rem.text != null) item.text = rem.text
      reminders.push(item)
    }
    if (!tasks.length && !reminders.length) continue
    out.push({
      id: note.id,
      title: note.title || '',
      color: note.color || 'yellow',
      tasks,
      reminders
    })
  }
  return out
}

module.exports = { buildToday, localDayRange }
