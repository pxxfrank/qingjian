// 便笺 HTML 解析 / 派生缓存单元测试（纯 Node，直接跑：node tests/parse.test.js）
const fs = require('fs')
const os = require('os')
const path = require('path')
const { htmlToText, extractTasks, toggleTask } = require('../notes-parse')
const { createNoteIndex } = require('../note-index')
const { createStore } = require('../store')

let pass = 0
let fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name) }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  => ' + extra : '')) }
}

// ---------- htmlToText ----------
console.log('\n[parse] htmlToText')
ok('纯文本原样', htmlToText('<p>hello world</p>') === 'hello world')
ok('实体 &amp;', htmlToText('<p>a&amp;b</p>') === 'a&b')
ok('实体 &lt;/&gt;', htmlToText('<p>&lt;b&gt;</p>') === '<b>')
ok('实体 &quot;', htmlToText('<p>&quot;q&quot;</p>') === '"q"')
ok('实体 &#39;', htmlToText('<p>&#39;s&#39;</p>') === "'s'")
ok('实体 &nbsp; → 空格', htmlToText('<p>a&nbsp;b</p>') === 'a b')
ok('数字实体（十进制 / 十六进制）', htmlToText('<p>&#65;&#x42;</p>') === 'AB')
ok('<br> 转换行', htmlToText('<p>a<br>b</p>') === 'a\nb')
ok('相邻段落断行', htmlToText('<p>a</p><p>b</p>') === 'a\nb')
ok('标题 + 列表逐项成行', htmlToText('<h1>标题</h1><ul><li>x</li><li>y</li></ul>') === '标题\nx\ny')
ok('引用块', htmlToText('<blockquote>引用</blockquote>') === '引用')
ok('连续空行压缩为单个换行', htmlToText('<p>a</p><p><br></p><p>b</p>') === 'a\nb')
ok('嵌套行内保留文字', htmlToText('<p>a <strong>b <em>c</em></strong></p>') === 'a b c')
ok('img 忽略', htmlToText('<p>a<img src="x.png" alt="z">b</p>') === 'ab')
ok('空 / null 安全', htmlToText('') === '' && htmlToText(null) === '')

// ---------- extractTasks ----------
console.log('\n[parse] extractTasks')
const t1 = extractTasks('<ul><li class="checkbox">任务A</li></ul>')
ok('单个未勾选任务', t1.length === 1 && t1[0].index === 0 && t1[0].text === '任务A' && t1[0].checked === false, JSON.stringify(t1))
const t2 = extractTasks('<ul><li class="checkbox checked">任务B</li></ul>')
ok('已勾选任务 checked=true', t2.length === 1 && t2[0].checked === true, JSON.stringify(t2))
const t3 = extractTasks('<ul><li>普通项</li><li class="checkbox">x</li><li>也普通</li><li class="checkbox checked">z</li></ul>')
ok('index 仅按 checkbox 递增', t3.length === 2 && t3[0].index === 0 && t3[0].text === 'x' &&
  t3[1].index === 1 && t3[1].text === 'z' && t3[1].checked === true, JSON.stringify(t3))
const t4 = extractTasks('<ul><li class="checkbox"><strong>加粗</strong>任务</li></ul>')
ok('任务项文本去标签', t4.length === 1 && t4[0].text === '加粗任务', JSON.stringify(t4))
ok('无任务返回空数组', extractTasks('<p>无</p>').length === 0)
ok('空 / null 安全', extractTasks('').length === 0 && extractTasks(null).length === 0)

// ---------- toggleTask ----------
console.log('\n[parse] toggleTask')
const base = '<ul><li class="checkbox">a</li><li class="checkbox checked">b</li></ul>'
ok('勾选第 0 项', toggleTask(base, 0, true) === '<ul><li class="checkbox checked">a</li><li class="checkbox checked">b</li></ul>')
ok('取消第 1 项', toggleTask(base, 1, false) === '<ul><li class="checkbox">a</li><li class="checkbox">b</li></ul>')
ok('取消未勾选项无变化', toggleTask(base, 0, false) === base)
ok('勾选已勾选项无变化', toggleTask(base, 1, true) === base)
const toggled = toggleTask(base, 0, true)
ok('幂等：重复勾选结果一致', toggleTask(toggled, 0, true) === toggled)
ok('越界（过大）原样返回', toggleTask(base, 5, true) === base)
ok('越界（负数）原样返回', toggleTask(base, -1, true) === base)
const mixed = '<p>说明</p><ul><li class="x">保留</li><li class="checkbox" data-k="v">t</li></ul><p>尾部</p>'
const mixedOut = toggleTask(mixed, 0, true)
ok('非目标字节原样保留（其他 li / 属性 / 周围内容）',
  mixedOut === '<p>说明</p><ul><li class="x">保留</li><li class="checkbox checked" data-k="v">t</li></ul><p>尾部</p>', mixedOut)
ok('class 顺序与其它 token 保留', toggleTask('<li class="foo checkbox">t</li>', 0, true) === '<li class="foo checkbox checked">t</li>')
ok('单引号 class 保留引号风格', toggleTask("<li class='checkbox'>t</li>", 0, true) === "<li class='checkbox checked'>t</li>")

// ---------- note-index + store.readAllNotes ----------
console.log('\n[parse] note-index / readAllNotes')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-md-parse-'))
const store = createStore(path.join(tmp, 'notes'), path.join(tmp, 'settings.json'))
store.writeNote('idx1', { title: 't1', html: '<p>hello world</p>', createdAt: 1 })
store.writeNote('idx2', { title: 't2', html: '<ul><li class="checkbox">a</li><li class="checkbox checked">b</li></ul>', createdAt: 2 })

const all = store.readAllNotes()
ok('readAllNotes 返回完整对象', all.length === 2 && all.some((n) => n.id === 'idx1' && n.html === '<p>hello world</p>'))
ok('readAllNotes 过滤损坏文件', (() => {
  fs.writeFileSync(path.join(store.notesDir, 'broken.json'), '{not json', 'utf8')
  const list = store.readAllNotes()
  return !list.some((n) => n.id === 'broken') && list.length === 2
})())

const idx = createNoteIndex(store)
const g1 = idx.get('idx1')
ok('派生 text', g1 && g1.text === 'hello world' && g1.id === 'idx1', JSON.stringify(g1))
ok('缓存命中返回同一对象', idx.get('idx1') === g1)
store.writeNote('idx1', { html: '<p>changed</p>' })
idx.invalidate('idx1')
ok('失效后重算 text', idx.get('idx1').text === 'changed')
ok('派生任务项', (() => {
  const g = idx.get('idx2')
  return g.tasks.length === 2 && g.tasks[0].checked === false && g.tasks[1].checked === true
})())
idx.invalidateAll()
ok('invalidateAll 后仍可按需重算', idx.get('idx2').tasks.length === 2)
ok('不存在的便笺返回 null', idx.get('missing') === null)

console.log(`\n[parse] ${pass} passed, ${fail} failed`)
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(fail === 0 ? 0 : 1)
