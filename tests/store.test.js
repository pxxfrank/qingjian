// 存储层单元测试（纯 Node，直接跑：node tests/store.test.js）
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createStore } = require('../store')

let pass = 0
let fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name) }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  => ' + extra : '')) }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-md-store-'))
const store = createStore(path.join(tmp, 'notes'), path.join(tmp, 'settings.json'))

// 1. 空目录
ok('空目录 listNotes 返回空数组', Array.isArray(store.listNotes()) && store.listNotes().length === 0)

// 2. 创建 + 读取
const id1 = 'note-1'
const created = store.writeNote(id1, {
  title: '测试标题', html: '<p>内容</p>', preview: '内容', createdAt: 1000
})
const read1 = store.readNote(id1)
ok('创建后读取一致', read1 && read1.title === '测试标题' && read1.html === '<p>内容</p>')
ok('创建补齐 id/updatedAt', read1 && read1.id === id1 && typeof read1.updatedAt === 'number')

// 3. 更新合并（不丢 bounds）
store.writeNote(id1, { bounds: { x: 1, y: 2, width: 320, height: 260 } })
store.writeNote(id1, { title: '新标题' })
const read2 = store.readNote(id1)
ok('更新合并不丢 bounds', read2.title === '新标题' && read2.bounds && read2.bounds.width === 320)
ok('更新保留 html', read2.html === '<p>内容</p>')

// 4. 删除
store.deleteNote(id1)
ok('删除后 readNote 返回 null', store.readNote(id1) === null)
ok('删除后 listNotes 不含', !store.listNotes().some((n) => n.id === id1))

// 5. 排序（updatedAt 降序）
store.writeNote('a', { createdAt: 1 })
store.writeNote('b', { createdAt: 2 })
store.writeNote('c', { createdAt: 3 })
const ids = store.listNotes().map((n) => n.id)
ok('按 updatedAt 降序排序', ids[0] === 'c' && ids[1] === 'b' && ids[2] === 'a', JSON.stringify(ids))

// 6. 损坏 JSON 跳过
fs.writeFileSync(path.join(store.notesDir, 'broken.json'), '{not valid json', 'utf8')
const listed = store.listNotes()
ok('损坏 JSON 被跳过', !listed.some((n) => n.id === 'broken'))
ok('损坏 JSON readNote 返回 null', store.readNote('broken') === null)

// 7. unicode / emoji
const emojiId = 'emoji'
store.writeNote(emojiId, { title: '中文🎉🔤 特殊<>&"\'', html: '<p>😀😁😂</p>' })
const emojiRead = store.readNote(emojiId)
ok('unicode/emoji 标题正确往返', emojiRead.title === '中文🎉🔤 特殊<>&"\'')
ok('emoji 内容正确往返', emojiRead.html === '<p>😀😁😂</p>')

// 8. settings
ok('空 settings 返回 {}', Object.keys(store.readSettings()).length === 0)
store.writeSettings({ theme: 'dark' })
ok('writeSettings 后读取一致', store.readSettings().theme === 'dark')
store.writeSettings({ lang: 'zh' })
const mergedSettings = store.readSettings()
ok('settings patch 合并', mergedSettings.theme === 'dark' && mergedSettings.lang === 'zh')

// 9. 边界：不存在 id 不崩溃
store.deleteNote('not-exist')
ok('删除不存在 id 不崩溃', store.readNote('not-exist') === null)

// 10. 字段完整性（bounds 持久化）
const bid = 'bounds-note'
store.writeNote(bid, { title: 't', html: 'h', bounds: { x: 10, y: 20, width: 400, height: 300 } })
const boundsRead = store.readNote(bid)
ok('bounds 字段完整持久化', boundsRead.bounds && boundsRead.bounds.x === 10 && boundsRead.bounds.width === 400)

// 11. 回收站：删除 → 列表 / 恢复 / 彻底删除 / 清空
console.log('\n[store] 回收站')
const tid = 'trash-note'
store.writeNote(tid, { title: '待删除', html: '<p>x</p>', preview: 'x', color: 'blue' })
const trashBefore = store.trashCount() // 前面的用例可能已往回收站放过内容
store.moveToTrash(tid)
ok('删除后 readNote 返回 null', store.readNote(tid) === null)
ok('删除后进入回收站', store.trashCount() === trashBefore + 1)
const trashList = store.listTrash()
const trashItem = trashList.find((t) => t.id === tid)
ok('回收站条目含标题与删除时间', !!trashItem && trashItem.title === '待删除' && !!trashItem.deletedAt)
const beforeRestore = store.listNotes().length
const restored = store.restoreNote(tid)
ok('恢复返回内容', restored && restored.title === '待删除')
ok('恢复后回到便笺列表', store.listNotes().length === beforeRestore + 1 && store.readNote(tid).html === '<p>x</p>')
ok('恢复后回收站条数复原', store.trashCount() === trashBefore)

store.moveToTrash(tid)
ok('彻底删除成功', store.purgeNote(tid) === true && store.trashCount() === trashBefore)
store.writeNote('t2', { title: 'A' })
store.writeNote('t3', { title: 'B' })
store.moveToTrash('t2')
store.moveToTrash('t3')
const beforeEmpty = store.trashCount()
ok('清空回收站返回条数', store.emptyTrash() === beforeEmpty && store.trashCount() === 0)

// 12. 回收站过期清理（把 deletedAt 写成 31 天前）
store.writeNote('old', { title: '过期' })
store.moveToTrash('old')
const trashFile = path.join(store.trashDir, 'old.json')
const oldData = JSON.parse(fs.readFileSync(trashFile, 'utf8'))
oldData.deletedAt = Date.now() - 31 * 86400000
fs.writeFileSync(trashFile, JSON.stringify(oldData))
const pruned = store.pruneTrash(30)
ok('过期内容被清理', pruned === 1 && store.trashCount() === 0)

// 13. 原子写入：并发写不会留下临时文件
const aid = 'atomic-note'
for (let i = 0; i < 20; i++) store.writeNote(aid, { title: 'w' + i })
const leftovers = fs.readdirSync(path.join(tmp, 'notes')).filter((f) => f.includes('.tmp'))
ok('原子写入无临时文件残留', leftovers.length === 0 && store.readNote(aid).title === 'w19')

// 14. 提醒往返：listReminders / setReminder / removeReminder / getReminder
console.log('\n[store] 提醒')
const rid = 'remind-note'
store.writeNote(rid, { title: '提醒便笺', html: '<p>x</p>' })
store.setReminder(rid, { id: 'ra', at: 1000, repeat: 'once', anchorText: null, done: false, lastFired: null })
store.setReminder(rid, { id: 'rb', at: 2000, repeat: 'daily', anchorText: null, done: false, lastFired: null })
const remList = store.listReminders().filter((r) => r.id === rid)
ok('listReminders 展平该便笺提醒', remList.length === 2 && remList.every((r) => r.id === rid))
ok('listReminders 项含 { id(便笺), rem }', !!remList[0].rem && typeof remList[0].rem.at === 'number')

// upsert：同 id 覆盖，不重复新增
store.setReminder(rid, { id: 'ra', at: 1500, done: true })
const ra = store.getReminder(rid, 'ra')
ok('setReminder 按 rem.id upsert（合并保留其余字段）', ra.at === 1500 && ra.done === true && ra.repeat === 'once')
ok('upsert 不重复新增', store.listReminders().filter((r) => r.id === rid).length === 2)

// remove
ok('removeReminder 删除命中', store.removeReminder(rid, 'ra') === true)
ok('removeReminder 后不再列出', store.getReminder(rid, 'ra') === null && store.listReminders().filter((r) => r.id === rid).length === 1)
ok('removeReminder 不存在 id 返回 false', store.removeReminder(rid, 'nope') === false)

// 渲染层 payload() 不发 remind：writeNote 浅合并后提醒不被清空
store.writeNote(rid, { title: '改标题', html: '<p>y</p>' })
ok('writeNote 合并保留 remind', !!store.getReminder(rid, 'rb') && store.getReminder(rid, 'rb').at === 2000)

console.log(`\n[store] ${pass} passed, ${fail} failed`)
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(fail === 0 ? 0 : 1)
