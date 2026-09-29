// 便笺派生缓存（主进程）：正文纯文本 + 任务项，供全文搜索与后续「今日看板」共用
// 以 id + updatedAt 为键缓存，updatedAt 变化才重算；写路径调用方需 invalidate。
const { htmlToText, extractTasks } = require('./notes-parse')

function createNoteIndex(store) {
  const cache = new Map() // id -> { updatedAt, value }

  // 惰性读取便笺并派生 { id, updatedAt, text, tasks }
  function get(id) {
    const note = store.readNote(id)
    if (!note) {
      cache.delete(id)
      return null
    }
    const updatedAt = note.updatedAt || 0
    const hit = cache.get(id)
    if (hit && hit.updatedAt === updatedAt) return hit.value
    const html = note.html || ''
    const value = {
      id,
      updatedAt,
      text: htmlToText(html),
      tasks: extractTasks(html)
    }
    cache.set(id, { updatedAt, value })
    return value
  }

  function invalidate(id) {
    cache.delete(id)
  }

  function invalidateAll() {
    cache.clear()
  }

  return { get, invalidate, invalidateAll }
}

module.exports = { createNoteIndex }
