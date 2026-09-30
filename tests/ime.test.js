// 输入法合成端到端测试：合成宿主就绪（首字母不被吞）/ 完整合成流程 / 合成期间守卫
// 核心不变量：compositionstart 之后，光标必须处在「文本节点」内——否则 Chromium 会新建
// 文本节点，这个 DOM 变动会打断合成，导致拼音首字母被直接上屏成英文（如 shuohua → s huohua）。
module.exports = {
  name: 'ime',
  run: async (h) => {
    const { ok, createNoteWindow, evalIn, sleep } = h
    const win = await createNoteWindow('ime')
    await sleep(120)

    const res = await evalIn(win, `(() => {
      const ed = document.getElementById('editor')
      const sentinelCount = () => (ed.textContent.match(/\\u200B/g) || []).length
      const caretInText = () => {
        const s = getSelection()
        return s.rangeCount ? s.getRangeAt(0).startContainer.nodeType === 3 : false
      }
      const setCaret = (node, offset) => {
        const r = document.createRange()
        r.setStart(node, offset); r.collapse(true)
        const s = getSelection(); s.removeAllRanges(); s.addRange(r)
      }
      const host = []
      const scenario = (name, html, place) => {
        ed.innerHTML = html
        ed.focus()
        place()
        ed.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
        host.push({ name, inText: caretInText(), sentinel: sentinelCount() })
      }

      // —— 合成宿主就绪：以下布局在 compositionstart 后光标都必须落在文本节点内 ——
      scenario('空段落', '<p><br></p>', () => setCaret(ed.querySelector('p'), 0))
      scenario('空列表项', '<ul><li><br></li></ul>', () => setCaret(ed.querySelector('li'), 0))
      scenario('空引用', '<blockquote><br></blockquote>', () => setCaret(ed.querySelector('blockquote'), 0))
      scenario('空标题', '<h2><br></h2>', () => setCaret(ed.querySelector('h2'), 0))
      scenario('行尾纯文本（对照，本就在文本节点）', '<p>hello</p>', () => setCaret(ed.querySelector('p').firstChild, 5))
      scenario('行尾是行内元素', '<p>a<strong>b</strong></p>', () => setCaret(ed.querySelector('p'), 2))
      scenario('行首是行内元素', '<p><strong>b</strong>a</p>', () => setCaret(ed.querySelector('p'), 0))
      scenario('行尾是图片', '<p>a<img src="note-att://local/x.png"></p>', () => setCaret(ed.querySelector('p'), 2))
      scenario('空块内是图片', '<p><img src="note-att://local/x.png"></p>', () => setCaret(ed.querySelector('p'), 1))
      scenario('<br> 之后', '<p>a<br>b</p>', () => setCaret(ed.querySelector('p'), 2))
      scenario('行首紧邻 <br>', '<p><br>a</p>', () => setCaret(ed.querySelector('p'), 0))
      scenario('空编辑器', '', () => setCaret(ed, 0))

      // —— 完整合成流程：空块里拼音作为中文上屏，ZWSP 被清除 ——
      ed.innerHTML = '<p><br></p>'
      ed.focus()
      setCaret(ed.querySelector('p'), 0)
      ed.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
      const startedText = caretInText()
      const node0 = getSelection().getRangeAt(0).startContainer
      node0.data = node0.data + 'nihao'
      ed.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: 'nihao' }))
      ed.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'nihao', inputType: 'insertCompositionText' }))
      node0.data = node0.data.replace('nihao', '你好')
      ed.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好' }))
      const flow = { startedText, text: ed.textContent, sentinel: sentinelCount() }

      // —— 合成期间守卫：不触发块级转换（如 "# " 不应变成 H1）——
      ed.innerHTML = '<p><br></p>'
      ed.focus()
      setCaret(ed.querySelector('p'), 0)
      ed.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
      const host2 = getSelection().getRangeAt(0).startContainer
      host2.data = '# x'
      ed.dispatchEvent(new InputEvent('input', { bubbles: true, data: '# x', inputType: 'insertCompositionText' }))
      const duringHeading = !!ed.querySelector('h1')
      ed.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '# x' }))

      return { host, flow, duringHeading }
    })()`)

    console.log('\n[ime] 合成宿主就绪（compositionstart 后光标应在文本节点内）')
    for (const r of res.host) {
      ok('宿主就绪 · ' + r.name, r.inText === true, JSON.stringify(r))
    }

    console.log('\n[ime] 完整合成流程')
    ok('合成开始时宿主是文本节点（首字母不会丢）', res.flow.startedText === true, JSON.stringify(res.flow))
    ok('中文正确上屏', res.flow.text.includes('你好'), JSON.stringify(res.flow))
    ok('合成结束后无残留 ZWSP', res.flow.sentinel === 0, JSON.stringify(res.flow))

    console.log('\n[ime] 合成期间守卫')
    ok('合成期间输入标记不触发块级转换', res.duringHeading === false)

    win.destroy()
  }
}
