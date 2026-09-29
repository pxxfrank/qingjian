// WYSIWYG Markdown 渐进式转换引擎
// 从原 renderer/note.js 平移，逻辑保持不变；模块化后由 Vue 组件挂载

let editor = null
let onSave = () => {}
let onInput = () => {}
let composing = false // 输入法合成中：期间不做任何 DOM 改动，否则会打断合成

export function initEngine(el, hooks = {}) {
  editor = el
  if (hooks.onSave) onSave = hooks.onSave
  if (hooks.onInput) onInput = hooks.onInput
}

function scheduleSave() {
  onSave()
}

// ---------- 选区/块工具 ----------
const BLOCK_TAGS = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE'])

function currentBlock() {
  const sel = getSelection()
  if (!sel.rangeCount) return null
  let node = sel.getRangeAt(0).startContainer
  node = node.nodeType === 1 ? node : node.parentElement
  while (node && node !== editor) {
    if (BLOCK_TAGS.has(node.tagName)) return node
    node = node.parentElement
  }
  return null
}

function placeCaretAtEnd(el) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

// ---------- 输入法合成占位 ----------
// 空块（仅一个 <br> 占位）里开始拼音合成时，Chromium 会「去掉 <br>、新建文本节点」，
// 这个结构变动会打断合成，导致首个字母被直接上屏成英文（如 shuohua → s + huohua）。
// 合成开始前把占位换成零宽字符（ZWSP），给合成一个现成的文本节点即可避免；合成结束后清除。
const EMPTY_SENTINEL = '\u200B'

function ensureCompositionHost() {
  if (!editor) return
  const sel = getSelection()
  if (!sel.rangeCount) return
  let node = sel.getRangeAt(0).startContainer
  node = node.nodeType === 1 ? node : node.parentElement
  while (node && node !== editor && !BLOCK_TAGS.has(node.tagName)) node = node.parentElement
  if (!node || node === editor || node.textContent.trim()) return
  node.textContent = EMPTY_SENTINEL
  placeCaretAtEnd(node)
}

function stripSentinels() {
  if (!editor) return
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walker.nextNode())) {
    // 用 deleteData 逐个删：它会把同节点内的光标偏移一并左移；
    // 直接赋 nodeValue 会按 DOM 规范把偏移 >0 的选区重置到 0（光标跳最左）。
    let i
    while ((i = n.nodeValue.indexOf(EMPTY_SENTINEL)) !== -1) n.deleteData(i, 1)
  }
  // 占位被清空后补回 <br>，维持空块的静态表示
  editor.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,blockquote,pre').forEach((el) => {
    if (!el.textContent && !el.querySelector('br,img')) el.appendChild(document.createElement('br'))
  })
}

function caretAtEndOf(el) {
  const sel = getSelection()
  if (!sel.rangeCount) return false
  const range = sel.getRangeAt(0)
  if (!range.collapsed) return false
  const pre = document.createRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.endContainer, range.endOffset)
  return pre.toString().length >= (el.textContent || '').length
}

function textNodeAtCaret() {
  const sel = getSelection()
  if (!sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType === 3) return node
  if (node.nodeType === 1) {
    const child = node.childNodes[range.startOffset]
    if (child && child.nodeType === 3) return child
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    let last = null
    while (walker.nextNode()) last = walker.currentNode
    return last
  }
  return null
}

// ---------- 行内语法转换 ----------
const INLINE_PATTERNS = [
  { re: /\*\*([^*\n]+)\*\*/, tag: 'strong' },
  { re: /~~([^~\n]+)~~/, tag: 'del' },
  { re: /__([^_\n]+)__/, tag: 'u' },
  { re: /(?<!\*)\*([^*\n]+)\*/, tag: 'em' },
  { re: /(?<!_)_([^_\n]+)_/, tag: 'em' },
  { re: /`([^`\n]+)`/, tag: 'code' }
]

function convertInline(node) {
  const text = node.textContent
  if (!text) return false
  let best = null
  for (const p of INLINE_PATTERNS) {
    const m = new RegExp(p.re.source + '$').exec(text)
    if (m && (!best || m.index < best.start)) {
      best = { start: m.index, end: m.index + m[0].length, content: m[1], tag: p.tag }
    }
  }
  if (!best) return false
  const after = node.splitText(best.end)
  const seg = node.splitText(best.start)
  const el = document.createElement(best.tag)
  el.textContent = best.content
  node.parentNode.insertBefore(el, seg)
  seg.remove()
  if (!node.textContent) node.remove()
  const range = document.createRange()
  range.setStart(after, 0)
  range.collapse(true)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
  return true
}

// ---------- 块级语法转换 ----------
function makeLi(text, cls) {
  const li = document.createElement('li')
  if (text) li.textContent = text
  else li.innerHTML = '<br>'
  if (cls) li.className = cls
  return li
}

const BLOCK_PATTERNS = [
  {
    re: /^(#{1,6})\s+(.*)$/,
    make: (m) => {
      const el = document.createElement('h' + m[1].length)
      if (m[2]) el.textContent = m[2]
      else el.innerHTML = '<br>'
      return el
    }
  },
  {
    re: /^[-*+]\s+(.*)$/,
    kind: 'list',
    make: (m) => {
      const ul = document.createElement('ul')
      ul.appendChild(makeLi(m[1]))
      return ul
    }
  },
  {
    re: /^(\d+)\.\s+(.*)$/,
    kind: 'list',
    make: (m) => {
      const ol = document.createElement('ol')
      ol.start = parseInt(m[1], 10)
      ol.appendChild(makeLi(m[2]))
      return ol
    }
  },
  {
    re: /^\[([ xX]?)\]\s+(.*)$/,
    kind: 'task',
    make: (m) => {
      const ul = document.createElement('ul')
      ul.appendChild(makeLi(m[2], 'checkbox' + ((m[1] || '').toLowerCase() === 'x' ? ' checked' : '')))
      return ul
    }
  },
  {
    re: /^>\s+(.*)$/,
    make: (m) => {
      const bq = document.createElement('blockquote')
      if (m[1]) bq.textContent = m[1]
      else bq.innerHTML = '<br>'
      return bq
    }
  }
]

function convertBlock(block) {
  const text = block.textContent
  if (text.includes('\n')) return false
  for (const p of BLOCK_PATTERNS) {
    const m = p.re.exec(text)
    if (m && m.index === 0) {
      // 已经在列表项里：绝不再新建列表，否则会嵌套出 <ol><ol>…（越套越深，编号乱掉）。
      // 列表标记只抹掉标记、沿用当前项；其余块级语法在列表项内同样不处理。
      if (block.tagName === 'LI') {
        if (!p.kind) return false
        block.textContent = m[2] || ''
        if (!block.textContent) block.innerHTML = '<br>'
        if (p.kind === 'task') {
          block.className = 'checkbox' + ((m[1] || '').toLowerCase() === 'x' ? ' checked' : '')
        }
        placeCaretAtEnd(block)
        return true
      }
      const el = p.make(m)
      block.replaceWith(el)
      placeCaretAtEnd(el)
      return true
    }
  }
  return false
}

// ---------- 回车 / 退格 ----------
function exitBlock(block) {
  const parent = block.parentElement
  const p = document.createElement('p')
  p.innerHTML = '<br>'
  if (parent && (parent.tagName === 'OL' || parent.tagName === 'UL')) {
    // 空列表项回车/退格 → 变成段落：段落必须落在列表【外面】。
    // 若塞进 <ol> 里，之后在这个段落上输入列表标记就会嵌出 <ol><ol>…（编号乱了）。
    const rest = []
    for (let n = block.nextElementSibling; n; n = n.nextElementSibling) rest.push(n)
    const before = [...parent.children].indexOf(block)
    block.remove()
    if (rest.length) {
      const tail = parent.cloneNode(false)
      if (parent.tagName === 'OL') tail.start = (parseInt(parent.getAttribute('start'), 10) || 1) + before + 1
      rest.forEach((n) => tail.appendChild(n))
      parent.after(tail)
    }
    parent.after(p)
    if (!parent.childElementCount) parent.remove()
  } else {
    block.after(p)
    block.remove()
    if (parent && !parent.childElementCount) parent.remove()
  }
  placeCaretAtEnd(p)
}

function handleEnter(block) {
  if (block.tagName === 'LI') {
    if (!block.textContent.trim()) { exitBlock(block); return }
    const li = document.createElement('li')
    if (block.classList.contains('checkbox')) li.className = 'checkbox'
    li.innerHTML = '<br>'
    block.after(li)
    placeCaretAtEnd(li)
  } else if (block.tagName === 'BLOCKQUOTE') {
    if (!block.textContent.trim()) { exitBlock(block); return }
    const bq = document.createElement('blockquote')
    bq.innerHTML = '<br>'
    block.after(bq)
    placeCaretAtEnd(bq)
  } else {
    const p = document.createElement('p')
    p.innerHTML = '<br>'
    block.after(p)
    placeCaretAtEnd(p)
  }
}

function handleBackspace(e) {
  const block = currentBlock()
  if (!block || block.tagName !== 'LI' || block.textContent.trim()) return
  const sel = getSelection()
  if (!sel.rangeCount) return
  const range = sel.getRangeAt(0)
  const r = document.createRange()
  r.selectNodeContents(block)
  r.collapse(true)
  if (range.compareBoundaryPoints(Range.START_TO_START, r) === 0) {
    e.preventDefault()
    exitBlock(block)
    scheduleSave()
  }
}

// 光标是否在某个块的最前面（用「块内剩余文本长度 == 全文字长度」判断，比边界点比较可靠）
function caretAtStartOf(el) {
  const sel = getSelection()
  if (!sel.rangeCount) return false
  const range = sel.getRangeAt(0)
  if (!range.collapsed) return false
  const rest = document.createRange()
  rest.selectNodeContents(el)
  rest.setStart(range.endContainer, range.endOffset)
  return rest.toString().length >= (el.textContent || '').length
}

// 光标是否正处在列表「最前面」（列表的第一项、且光标在本项文字起点）；是则返回该列表
function listAtCaretFront() {
  const block = currentBlock()
  if (!block || block.tagName !== 'LI') return null
  const list = block.parentElement
  if (!list || (list.tagName !== 'OL' && list.tagName !== 'UL')) return null
  if (list.firstElementChild !== block) return null
  return caretAtStartOf(block) ? list : null
}

// 在列表最前面按空格：在列表上方插入一个空段落，列表整体下移
function insertLineAboveList() {
  const list = listAtCaretFront()
  if (!list) return false
  const p = document.createElement('p')
  p.innerHTML = '<br>'
  list.before(p)
  placeCaretAtEnd(p) // 光标落到新空行，可直接往上打字
  return true
}

// ---------- 规范化 ----------
export function normalize() {
  if (!editor || composing) return // 合成期间跳过：挪动文本节点会打断输入法合成
  editor.querySelectorAll('div').forEach((d) => {
    const p = document.createElement('p')
    p.innerHTML = d.innerHTML
    d.replaceWith(p)
  })
  Array.from(editor.childNodes).forEach((n) => {
    if (n.nodeType === 3 && n.textContent.trim()) {
      const p = document.createElement('p')
      n.before(p)
      p.appendChild(n)
    }
  })
  stripSentinels()
}

// ---------- 事件绑定（keydown / input / click） ----------
// 处理一次输入：规范化块结构 → 行尾触发块级/行内语法转换 → 触发保存
function processInput() {
  normalize()
  onInput()
  const block = currentBlock()
  if (block && caretAtEndOf(block)) {
    if (convertBlock(block)) { scheduleSave(); return }
    const node = textNodeAtCaret()
    if (node && convertInline(node)) { scheduleSave(); return }
  }
  scheduleSave()
}

export function bindEditorEvents() {
  // 输入法合成期间不做任何 DOM 处理：一旦挪动/替换正在组合的文本节点，合成会被打断，
  // 表现为首字母被吞成英文（如输入 shuohua → 只留下 s + huohua）。
  editor.addEventListener('compositionstart', () => { composing = true; ensureCompositionHost() })
  editor.addEventListener('compositionend', () => { composing = false; processInput() })

  editor.addEventListener('keydown', (e) => {
    if (composing || e.isComposing || e.keyCode === 229) return // 合成中的按键（含回车选词）交给输入法
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const block = currentBlock()
      if (block) handleEnter(block)
      scheduleSave()
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      // 列表最前面按空格 = 在列表上方插入空行（而不是往列表项里塞前导空格）
      if (insertLineAboveList()) { e.preventDefault(); scheduleSave() }
    } else if (e.key === 'Backspace') {
      handleBackspace(e)
    } else if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 'X')) {
      e.preventDefault()
      document.execCommand('strikeThrough')
      scheduleSave()
    }
  })

  editor.addEventListener('input', (e) => {
    if (composing || e.isComposing) return // 合成期间跳过，等 compositionend 再统一处理
    processInput()
  })

  editor.addEventListener('click', (e) => {
    const li = e.target.closest ? e.target.closest('li.checkbox') : null
    if (li) {
      li.classList.toggle('checked')
      scheduleSave()
    }
  })
}

// ---------- 光标工具（供 Vue 组件使用） ----------
export function focusEditorAtEnd() {
  if (!editor) return
  editor.focus()
  if (editor.firstElementChild) placeCaretAtEnd(editor.firstElementChild)
}

// ---------- 工具栏命令（供 Vue 组件调用） ----------
export function exec(cmd) {
  if (!editor) return
  editor.focus()
  document.execCommand(cmd)
  scheduleSave()
}

export function heading(n) {
  const block = currentBlock()
  if (!block) return
  if (block.tagName === 'H' + n) {
    const p = document.createElement('p')
    p.innerHTML = block.innerHTML
    block.replaceWith(p)
    placeCaretAtEnd(p)
  } else {
    const h = document.createElement('h' + n)
    h.innerHTML = block.innerHTML
    block.replaceWith(h)
    placeCaretAtEnd(h)
  }
  scheduleSave()
}

export function listCmd(type) {
  const block = currentBlock()
  if (!block) return
  const inList = block.tagName === 'LI'
  const same = inList && (
    (type === 'ol' && block.parentElement.tagName === 'OL') ||
    (type === 'task' && block.classList.contains('checkbox')) ||
    (type === 'ul' && block.parentElement.tagName === 'UL' && !block.classList.contains('checkbox'))
  )
  if (same) {
    const p = document.createElement('p')
    p.innerHTML = block.innerHTML
    block.replaceWith(p)
    placeCaretAtEnd(p)
  } else {
    const container = document.createElement(type === 'ol' ? 'ol' : 'ul')
    const li = document.createElement('li')
    if (type === 'task') li.className = 'checkbox'
    li.innerHTML = block.innerHTML
    container.appendChild(li)
    block.replaceWith(container)
    placeCaretAtEnd(li)
  }
  scheduleSave()
}

export function quoteCmd() {
  const block = currentBlock()
  if (!block) return
  if (block.tagName === 'BLOCKQUOTE') {
    const p = document.createElement('p')
    p.innerHTML = block.innerHTML
    block.replaceWith(p)
    placeCaretAtEnd(p)
  } else {
    const bq = document.createElement('blockquote')
    bq.innerHTML = block.innerHTML
    block.replaceWith(bq)
    placeCaretAtEnd(bq)
  }
  scheduleSave()
}

export function inlineCodeCmd() {
  if (!editor) return
  editor.focus()
  const sel = getSelection()
  const text = sel.toString()
  if (text) {
    document.execCommand('insertText', false, '`' + text + '`')
  } else {
    document.execCommand('insertText', false, '``')
    const range = sel.getRangeAt(0)
    if (range.startContainer.nodeType === 3 && range.startContainer.length >= 1) {
      range.setStart(range.startContainer, 1)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }
  scheduleSave()
}

export function insertImageData(dataUrl) {
  if (!dataUrl || !editor) return
  editor.focus()
  document.execCommand('insertImage', false, dataUrl)
  const img = editor.querySelector('img:not(.note-img)')
  if (img) img.classList.add('note-img')
  scheduleSave()
}

export function pastePlainText(text) {
  if (!editor) return
  const lines = text.split(/\r?\n/)
  if (!editor.firstElementChild) {
    const p = document.createElement('p')
    p.innerHTML = '<br>'
    editor.appendChild(p)
    placeCaretAtEnd(p)
  }
  document.execCommand('insertText', false, lines[0])
  let block = currentBlock()
  for (let i = 1; i < lines.length; i++) {
    const p = document.createElement('p')
    p.textContent = lines[i]
    if (block) block.after(p)
    else editor.appendChild(p)
    placeCaretAtEnd(p)
    block = p
  }
  scheduleSave()
}
