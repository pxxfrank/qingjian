// 便笺 HTML 解析（纯 Node，无外部依赖）：正文转纯文本 / 抽取任务项 / 切换任务勾选
// 编辑器产出的 HTML 受限（p/h1-6/ul>li/ol>li/blockquote/strong/em/u/del/code/img/br，
// 任务项是 <li class="checkbox"> / <li class="checkbox checked">），用轻量标签处理即可，
// 不引入 HTML 解析库（package.json 的 build.files 是白名单，不含 node_modules）。

const BR_RE = /<br\s*\/?>/gi
const IMG_RE = /<img\b[^>]*>/gi
const BLOCK_TAG_RE = /<\/?(?:p|div|h[1-6]|li|blockquote|tr)\b[^>]*>/gi
const ANY_TAG_RE = /<[^>]*>/g
const LI_RE = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi
const LI_OPEN_RE = /<li\b([^>]*)>/gi
const CLASS_RE = /(\bclass\s*=\s*)("([^"]*)"|'([^']*)'|([^\s>]+))/i

// 反转义实体：命名实体（含 &nbsp;）+ 十进制 / 十六进制数字实体
function unescapeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, ent) => {
    if (ent.charAt(0) === '#') {
      const hex = ent.charAt(1) === 'x' || ent.charAt(1) === 'X'
      const code = hex ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10)
      if (Number.isFinite(code) && code >= 0 && code <= 0x10FFFF) {
        try { return String.fromCodePoint(code) } catch { return whole }
      }
      return whole
    }
    switch (ent) {
      case 'amp': return '&'
      case 'lt': return '<'
      case 'gt': return '>'
      case 'quot': return '"'
      case 'apos': return "'"
      case 'nbsp': return ' '
      default: return whole
    }
  })
}

// 取 li 开始标签上的 class 值（无 class 返回空串）
function classOf(attrs) {
  const m = CLASS_RE.exec(attrs)
  if (!m) return ''
  if (m[3] != null) return m[3]
  if (m[4] != null) return m[4]
  return m[5] || ''
}

// 便笺 HTML → 纯文本：块级标签与 <br> 转换行，img 忽略，反转义实体，压缩连续空行，trim
function htmlToText(html) {
  if (html == null || html === '') return ''
  let s = String(html)
  s = s.replace(IMG_RE, '')       // 图片忽略（不参与文本）
  s = s.replace(BR_RE, '\n')      // 换行
  s = s.replace(BLOCK_TAG_RE, '\n') // 块级标签前后断行
  s = s.replace(ANY_TAG_RE, '')   // 剥离剩余行内标签
  s = unescapeEntities(s)
  s = s.replace(/\r\n?/g, '\n')
  s = s.replace(/[ \t]+\n/g, '\n')   // 去行尾空白
  s = s.replace(/\n[ \t]+\n/g, '\n\n') // 清掉空行里的空白（可能需多轮，交给下面的压缩兜底）
  s = s.replace(/\n{2,}/g, '\n')     // 连续空行压缩为单个换行
  return s.trim()
}

// 抽取任务项：index = 文档序中第 N 个 li.checkbox（0 基），checked = class 含 checked
function extractTasks(html) {
  const out = []
  if (html == null || html === '') return out
  const src = String(html)
  LI_RE.lastIndex = 0
  let m
  let index = 0
  while ((m = LI_RE.exec(src))) {
    const cls = classOf(m[1] || '')
    if (!/\bcheckbox\b/.test(cls)) continue
    out.push({
      index: index++,
      text: htmlToText(m[2]),
      checked: /\bchecked\b/.test(cls)
    })
  }
  return out
}

// 仅改写第 index 个 li.checkbox 的 class（加/去 checked），其余字节原样保留；index 越界返回原串
function setCheckedClass(attrs, checked) {
  const cm = CLASS_RE.exec(attrs)
  if (!cm) {
    if (!checked) return null
    return `${attrs} class="checkbox checked"`
  }
  const quote = cm[3] != null ? '"' : cm[4] != null ? "'" : '"'
  const raw = cm[3] != null ? cm[3] : cm[4] != null ? cm[4] : (cm[5] || '')
  const tokens = raw.split(/\s+/).filter(Boolean)
  const has = tokens.includes('checked')
  if (checked === has) return null // 无变化（幂等）
  const next = checked ? [...tokens, 'checked'] : tokens.filter((t) => t !== 'checked')
  const value = cm[1] + quote + next.join(' ') + quote
  return attrs.slice(0, cm.index) + value + attrs.slice(cm.index + cm[0].length)
}

function toggleTask(html, index, checked) {
  if (html == null || html === '') return html
  const src = String(html)
  LI_OPEN_RE.lastIndex = 0
  let m
  let count = 0
  let target = null
  while ((m = LI_OPEN_RE.exec(src))) {
    const cls = classOf(m[1] || '')
    if (!/\bcheckbox\b/.test(cls)) continue
    if (count === index) {
      target = { start: m.index, end: m.index + m[0].length, attrs: m[1] || '' }
      break
    }
    count++
  }
  if (!target) return html // 越界（含负数）：原样返回
  const attrs = setCheckedClass(target.attrs, !!checked)
  if (attrs == null) return html
  return src.slice(0, target.start) + `<li${attrs}>` + src.slice(target.end)
}

module.exports = { htmlToText, extractTasks, toggleTask }
