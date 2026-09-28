// 真实键盘输入测试（sendInputEvent 逐字符）
module.exports = {
  name: 'keyboard',
  run: async (h) => {
    const { ok, createNoteWindow, sendKeys, evalIn, sleep } = h
    const win = await createNoteWindow('kb-test')
    win.show()
    win.focus()
    await sleep(200)
    const html = () => evalIn(win, `document.getElementById('editor').innerHTML`)

    console.log('\n[keyboard] 真实键入')
    await evalIn(win, `(() => { const ed = document.getElementById('editor'); ed.innerHTML = '<p><br></p>'; const p = ed.querySelector('p'); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ed.focus() })()`)
    await sendKeys(win, '- ')
    ok('键入 "- " -> 列表', (await html()).includes('<ul>'), await html())

    await evalIn(win, `(() => { const ed = document.getElementById('editor'); ed.innerHTML = '<p><br></p>'; const p = ed.querySelector('p'); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ed.focus() })()`)
    await sendKeys(win, '[] ')
    ok('键入 "[] " -> 复选框', (await html()).includes('checkbox'), await html())

    await evalIn(win, `(() => { const ed = document.getElementById('editor'); ed.innerHTML = '<p><br></p>'; const p = ed.querySelector('p'); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ed.focus() })()`)
    await sendKeys(win, '**x**')
    ok('键入 "**x**" -> 加粗', (await html()).includes('<strong>x</strong>'), await html())

    // 标题：空块占位回归
    await evalIn(win, `(() => { const ed = document.getElementById('editor'); ed.innerHTML = '<p><br></p>'; const p = ed.querySelector('p'); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ed.focus() })()`)
    await sendKeys(win, '# ')
    await sendKeys(win, 'abc')
    ok('键入 "# abc" -> h1', (await html()).includes('<h1>abc</h1>'), await html())

    // 回车延续列表
    await evalIn(win, `(() => { const ed = document.getElementById('editor'); ed.innerHTML = '<ul><li>a</li></ul>'; const li = ed.querySelector('li'); const r = document.createRange(); r.selectNodeContents(li); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ed.focus() })()`)
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
    await sleep(100)
    const liCount = await evalIn(win, `document.querySelectorAll('#editor li').length`)
    ok('真实 Enter 延续列表', liCount === 2, 'liCount=' + liCount)

    // 中文内容不崩溃且正确保存
    const zh = await evalIn(win, `(() => {
      const ed = document.getElementById('editor')
      ed.innerHTML = '<p><br></p>'
      const p = ed.querySelector('p')
      p.textContent = '中文内容🎉 与 emoji 😀'
      const r = document.createRange(); r.selectNodeContents(p); r.collapse(false)
      const s = getSelection(); s.removeAllRanges(); s.addRange(r)
      ed.dispatchEvent(new InputEvent('input', { bubbles: true }))
      return ed.innerHTML
    })()`)
    ok('中文/emoji 内容正确处理', zh.includes('中文内容🎉') && zh.includes('😀'), zh)

    win.destroy()
  }
}
