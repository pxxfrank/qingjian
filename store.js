// 便笺存储模块（纯 Node，无 Electron 依赖，便于独立测试）
// - 写入采用「临时文件 + rename」原子替换，避免崩溃/断电写坏 JSON
// - 删除先移入回收站（默认 30 天后清理），误删可恢复
const fs = require('fs')
const path = require('path')

const TRASH_DAYS = 30 // 回收站保留天数

function createStore(notesDir, settingsFile, trashDir) {
  const trash = trashDir || path.join(path.dirname(notesDir), 'trash')

  function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true })
  }

  function ensureNotesDir() {
    ensureDir(notesDir)
  }

  function ensureTrashDir() {
    ensureDir(trash)
  }

  // 原子写入：先写同目录临时文件，再 rename 覆盖（同分区 rename 为原子操作）
  function writeAtomic(file, text) {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
    fs.writeFileSync(tmp, text, 'utf8')
    try {
      fs.renameSync(tmp, file)
    } catch (err) {
      try { fs.unlinkSync(tmp) } catch { /* ignore */ }
      throw err
    }
  }

  function noteFile(id) {
    return path.join(notesDir, `${id}.json`)
  }

  function readJson(file) {
    if (!fs.existsSync(file)) return null
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      return null
    }
  }

  function listNotes() {
    ensureNotesDir()
    return fs.readdirSync(notesDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const data = readJson(path.join(notesDir, f))
        if (!data) return null
        return { id: data.id, createdAt: data.createdAt, updatedAt: data.updatedAt }
      })
      .filter(Boolean)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  }

  function readNote(id) {
    return readJson(noteFile(id))
  }

  function writeNote(id, data) {
    ensureNotesDir()
    const prev = readNote(id) || {}
    const merged = { ...prev, ...data, id, updatedAt: Date.now() }
    writeAtomic(noteFile(id), JSON.stringify(merged))
    return merged
  }

  // ---------- 回收站 ----------
  // 删除 = 移入回收站（保留内容与元信息），可在列表窗口「回收站」里恢复
  function moveToTrash(id) {
    const file = noteFile(id)
    if (!fs.existsSync(file)) return false
    const note = readNote(id) || { id }
    ensureTrashDir()
    writeAtomic(path.join(trash, `${id}.json`), JSON.stringify({ ...note, id, deletedAt: Date.now() }))
    fs.unlinkSync(file)
    return true
  }

  function listTrash() {
    ensureTrashDir()
    return fs.readdirSync(trash)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const full = path.join(trash, f)
        const data = readJson(full)
        const fallbackAt = (() => {
          try { return fs.statSync(full).mtimeMs } catch { return 0 }
        })()
        if (!data) return null
        return {
          id: data.id || f.replace(/\.json$/, ''),
          title: data.title || '',
          preview: data.preview || '',
          color: data.color || 'yellow',
          deletedAt: data.deletedAt || fallbackAt
        }
      })
      .filter(Boolean)
      .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
  }

  function trashCount() {
    ensureTrashDir()
    return fs.readdirSync(trash).filter((f) => f.endsWith('.json')).length
  }

  // 恢复：回写到便笺目录，并刷新 updatedAt 使其出现在列表顶部
  function restoreNote(id) {
    const file = path.join(trash, `${id}.json`)
    const data = readJson(file)
    if (!data) return null
    delete data.deletedAt
    data.updatedAt = Date.now()
    ensureNotesDir()
    writeAtomic(noteFile(id), JSON.stringify(data))
    fs.unlinkSync(file)
    return data
  }

  function purgeNote(id) {
    const file = path.join(trash, `${id}.json`)
    if (!fs.existsSync(file)) return false
    fs.unlinkSync(file)
    return true
  }

  function emptyTrash() {
    ensureTrashDir()
    let n = 0
    for (const f of fs.readdirSync(trash)) {
      try { fs.unlinkSync(path.join(trash, f)); n++ } catch { /* ignore */ }
    }
    return n
  }

  // 清理超过保留期的回收站内容（应用启动时调用）
  function pruneTrash(days = TRASH_DAYS) {
    ensureTrashDir()
    const limit = Date.now() - days * 86400000
    let n = 0
    for (const f of fs.readdirSync(trash)) {
      if (!f.endsWith('.json')) continue
      const full = path.join(trash, f)
      const data = readJson(full)
      const at = (data && data.deletedAt) || (() => {
        try { return fs.statSync(full).mtimeMs } catch { return Date.now() }
      })()
      if (at < limit) {
        try { fs.unlinkSync(full); n++ } catch { /* ignore */ }
      }
    }
    return n
  }

  function readSettings() {
    try {
      return JSON.parse(fs.readFileSync(settingsFile, 'utf8')) || {}
    } catch {
      return {}
    }
  }

  function writeSettings(patch) {
    const merged = { ...readSettings(), ...patch }
    fs.writeFileSync(settingsFile, JSON.stringify(merged), 'utf8')
    return merged
  }

  return {
    notesDir,
    trashDir: trash,
    ensureNotesDir,
    listNotes,
    readNote,
    writeNote,
    deleteNote: moveToTrash,
    moveToTrash,
    listTrash,
    trashCount,
    restoreNote,
    purgeNote,
    emptyTrash,
    pruneTrash,
    readSettings,
    writeSettings
  }
}

module.exports = { createStore, TRASH_DAYS }
