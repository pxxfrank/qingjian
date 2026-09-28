// 编辑器 WYSIWYG 引擎测试
module.exports = {
  name: 'engine',
  run: async (h) => {
    const { ok, createNoteWindow, typeText, evalIn } = h
    const win = await createNoteWindow('engine-test')

    console.log('\n[engine] 块级转换')
    ok('h1', (await typeText(win, '# 大标题')).includes('<h1>大标题</h1>'))
    ok('h2', (await typeText(win, '## 二')).includes('<h2>二</h2>'))
    ok('h6', (await typeText(win, '###### 六')).includes('<h6>六</h6>'))
    ok('ul -', (await typeText(win, '- item')).includes('<ul>'))
    ok('ul *', (await typeText(win, '* item')).includes('<ul>'))
    ok('ul +', (await typeText(win, '+ item')).includes('<ul>'))
    const ol = await typeText(win, '3. 第三项')
    ok('ol start=3', /<ol[^>]*start="?3"?/.test(ol), ol)
    ok('checkbox []', (await typeText(win, '[] 待办')).includes('checkbox'))
    ok('checkbox [ ]', (await typeText(win, '[ ] 待办')).includes('checkbox'))
    ok('checkbox [x] 勾选', (await typeText(win, '[x] 完成')).includes('checked'))
    ok('checkbox [X] 勾选', (await typeText(win, '[X] 完成')).includes('checked'))
    ok('blockquote', (await typeText(win, '> 引用')).includes('<blockquote>'))
    ok('反例 -无空格 不转列表', !(await typeText(win, '-无空格')).includes('<ul>'))
    ok('反例 #无空格 不转标题', !(await typeText(win, '#无空格')).includes('<h1>'))

    console.log('\n[engine] 行内转换')
    ok('strong **', (await typeText(win, '**加粗**')).includes('<strong>加粗</strong>'))
    ok('em *', (await typeText(win, '*斜*')).includes('<em>斜</em>'))
    ok('em _', (await typeText(win, '_斜_')).includes('<em>斜</em>'))
    ok('u __', (await typeText(win, '__下划线__')).includes('<u>下划线</u>'))
    ok('del ~~', (await typeText(win, '~~删~~')).includes('<del>删</del>'))
    ok('code `', (await typeText(win, '`码`')).includes('<code>码</code>'))
    const prio = await typeText(win, '**a**')
    ok('优先级 **a** -> strong 而非 em', prio.includes('<strong>a</strong>'), prio)

    console.log('\n[engine] 光标位置')
    const mid = await evalIn(win, `(() => {
      const ed = document.getElementById('editor')
      ed.innerHTML = '<p><br></p>'
      const p = ed.querySelector('p')
      p.textContent = '- item tail'
      const r = document.createRange()
      r.setStart(p.firstChild, 2); r.collapse(true)
      const s = getSelection(); s.removeAllRanges(); s.addRange(r)
      ed.dispatchEvent(new InputEvent('input', { bubbles: true }))
      return ed.innerHTML
    })()`)
    ok('光标不在行尾不转换', mid === '<p>- item tail</p>', mid)

    console.log('\n[engine] 列表交互')
    const enterHtml = await evalIn(win, `(() => {
      const ed = document.getElementById('editor')
      ed.innerHTML = '<ul><li>a</li></ul>'
      const li = ed.querySelector('li')
      const r = document.createRange(); r.selectNodeContents(li); r.collapse(false)
      const s = getSelection(); s.removeAllRanges(); s.addRange(r)
      ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      return ed.innerHTML
    })()`)
    ok('回车延续列表', (enterHtml.match(/<li/g) || []).length === 2, enterHtml)

    const exitHtml = await evalIn(win, `(() => {
      const ed = document.getElementById('editor')
      ed.innerHTML = '<ul><li><br></li></ul>'
      const li = ed.querySelector('li')
      const r = document.createRange(); r.selectNodeContents(li); r.collapse(false)
      const s = getSelection(); s.removeAllRanges(); s.addRange(r)
      ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      return ed.innerHTML
    })()`)
    ok('空列表项回车退出为段落', exitHtml.includes('<p>'), exitHtml)

    const bsHtml = await evalIn(win, `(() => {
      const ed = document.getElementById('editor')
      ed.innerHTML = '<ul><li><br></li></ul>'
      const li = ed.querySelector('li')
      const r = document.createRange(); r.selectNodeContents(li); r.collapse(true)
      const s = getSelection(); s.removeAllRanges(); s.addRange(r)
      ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }))
      return ed.innerHTML
    })()`)
    ok('空列表项退格退出为段落', bsHtml.includes('<p>'), bsHtml)

    const ck = await evalIn(win, `(() => {
      const ed = document.getElementById('editor')
      ed.innerHTML = '<ul><li class="checkbox">任务</li></ul>'
      ed.querySelector('li').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return ed.querySelector('li').className
    })()`)
    ok('复选框点击切换勾选', ck.includes('checked'), ck)

    // 工具栏已精简为 B/I/U/S，块级与插入能力改由 markdown 输入 / 粘贴驱动
    console.log('\n[engine] 块级语法（markdown 输入）')
    const h1 = await typeText(win, '# x')
    ok('markdown -> h1', h1.includes('<h1>x</h1>'), h1)
    const ulCmd = await typeText(win, '- x')
    ok('markdown -> ul', ulCmd.includes('<ul>') && ulCmd.includes('<li>x</li>'), ulCmd)
    const q = await typeText(win, '> x')
    ok('markdown -> quote', q.includes('<blockquote>x</blockquote>'), q)

    console.log('\n[engine] 图片（粘贴路径）')
    const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const imgHtml = await evalIn(win, `(async () => {
      const ed = document.getElementById('editor')
      ed.innerHTML = '<p><br></p>'
      const p = ed.querySelector('p')
      const r = document.createRange(); r.selectNodeContents(p); r.collapse(false)
      const s = getSelection(); s.removeAllRanges(); s.addRange(r)
      const bin = Uint8Array.from(atob('${PNG_B64}'), (c) => c.charCodeAt(0))
      const file = new File([bin], 'a.png', { type: 'image/png' })
      const dt = new DataTransfer()
      dt.items.add(file)
      ed.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
      await new Promise(r => setTimeout(r, 400))
      return ed.innerHTML
    })()`)
    ok('粘贴图片插入 img.note-img', imgHtml.includes('img') && imgHtml.includes('note-img'), imgHtml)

    const imgSized = await evalIn(win, `(() => {
      const ed = document.getElementById('editor')
      const img = ed.querySelector('img.note-img')
      img.setAttribute('width', '300')
      img.setAttribute('height', '150')
      return ed.innerHTML
    })()`)
    ok('图片宽高属性随 HTML 持久化', imgSized.includes('width="300"') && imgSized.includes('height="150"'), imgSized)

    console.log('\n[engine] 粘贴 / normalize')
    const pasteHtml = await evalIn(win, `(() => {
      const ed = document.getElementById('editor')
      ed.innerHTML = '<p><br></p>'
      const p = ed.querySelector('p')
      const r = document.createRange(); r.selectNodeContents(p); r.collapse(false)
      const s = getSelection(); s.removeAllRanges(); s.addRange(r)
      const dt = new DataTransfer()
      dt.setData('text/plain', 'line1\\nline2')
      dt.setData('text/html', '<b>rich</b>')
      ed.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
      return ed.innerHTML
    })()`)
    ok('粘贴多行转段落 + HTML 剥离', pasteHtml.includes('line1') && pasteHtml.includes('line2') && !pasteHtml.includes('<b>'), pasteHtml)

    const normHtml = await evalIn(win, `(() => {
      const ed = document.getElementById('editor')
      ed.innerHTML = '<p>a</p>'
      ed.appendChild(document.createTextNode('- 裸文本'))
      const tn = ed.lastChild
      const r = document.createRange(); r.setStart(tn, tn.length); r.collapse(true)
      const s = getSelection(); s.removeAllRanges(); s.addRange(r)
      ed.dispatchEvent(new InputEvent('input', { bubbles: true }))
      return ed.innerHTML
    })()`)
    ok('normalize 裸文本 → p 并转换', normHtml.includes('<ul>') || normHtml.includes('<p>- 裸文本</p>'), normHtml)

    console.log('\n[engine] 图片粘贴 / 拖入 / 颜色')
    const pasteImg = await evalIn(win, `(async () => {
      const ed = document.getElementById('editor')
      ed.innerHTML = '<p><br></p>'
      const p = ed.querySelector('p')
      const r = document.createRange(); r.selectNodeContents(p); r.collapse(false)
      const s = getSelection(); s.removeAllRanges(); s.addRange(r)
      const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      const file = new File([blob], 'clip.png', { type: 'image/png' })
      const dt = new DataTransfer(); dt.items.add(file)
      ed.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
      await new Promise(r => setTimeout(r, 300))
      return ed.innerHTML
    })()`)
    ok('剪贴板图片粘贴', pasteImg.includes('img') && pasteImg.includes('note-img'), pasteImg)

    const dropImg = await evalIn(win, `(async () => {
      const ed = document.getElementById('editor')
      ed.innerHTML = '<p><br></p>'
      const p = ed.querySelector('p')
      const r = document.createRange(); r.selectNodeContents(p); r.collapse(false)
      const s = getSelection(); s.removeAllRanges(); s.addRange(r)
      const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      const file = new File([blob], 'drop.png', { type: 'image/png' })
      const dt = new DataTransfer(); dt.items.add(file)
      ed.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
      await new Promise(r => setTimeout(r, 300))
      return ed.innerHTML
    })()`)
    ok('拖入图片文件', dropImg.includes('img') && dropImg.includes('note-img'), dropImg)

    const color = await evalIn(win, `(async () => {
      document.querySelector('[title="便笺颜色"]').click()
      await new Promise(r => setTimeout(r, 100))
      document.querySelector('.swatch[data-color="pink"]').click()
      return document.body.dataset.color
    })()`)
    ok('便笺颜色设置', color === 'pink', color)
    await h.sleep(200)
    const colorStored = h.getStore().readNote('engine-test')
    ok('便笺颜色持久化', colorStored && colorStored.color === 'pink', JSON.stringify(colorStored && colorStored.color))

    win.destroy()
  }
}
