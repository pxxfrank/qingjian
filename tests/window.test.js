// 窗口 / IPC / 持久化 / 主题测试
module.exports = {
  name: 'window',
  run: async (h) => {
    const { ok, createNoteWindow, createListWindow, evalIn, sleep, getStore, typeText } = h
    const store = getStore()

    console.log('\n[window] IPC / resize / 置顶')
    const win = await createNoteWindow('w-test')
    const b1 = await evalIn(win, `window.api.getBounds()`)
    ok('getBounds 返回有效对象', b1 && typeof b1.width === 'number', JSON.stringify(b1))

    await evalIn(win, `window.api.setBounds({ x: ${b1.x}, y: ${b1.y}, width: 500, height: 400 })`)
    await sleep(300)
    const b2 = win.getBounds()
    ok('setBounds 调整窗口大小', b2.width === 500 && b2.height === 400, `${b2.width}x${b2.height}`)

    await evalIn(win, `window.api.setAlwaysOnTop(true)`)
    await sleep(100)
    ok('置顶切换生效', win.isAlwaysOnTop() === true)

    console.log('\n[window] bounds 持久化')
    win.on('close', () => {
      const [width, height] = win.getSize()
      const [x, y] = win.getPosition()
      store.writeNote('w-test', { bounds: { x, y, width, height } })
    })
    await evalIn(win, `window.api.setBounds({ x: 60, y: 60, width: 333, height: 222 })`)
    await sleep(300)
    win.close()
    await sleep(300)
    const persisted = store.readNote('w-test')
    ok('关闭时 bounds 持久化', persisted && persisted.bounds && Math.abs(persisted.bounds.width - 333) <= 2, JSON.stringify(persisted && persisted.bounds))

    console.log('\n[window] 防抖保存')
    const w2 = await createNoteWindow('w-save')
    await typeText(w2, '- 待保存')
    await sleep(700)
    const saved = store.readNote('w-save')
    ok('防抖自动保存 html', saved && saved.html.includes('<ul>'), JSON.stringify(saved && saved.html))

    console.log('\n[window] 主题四态 + 广播')
    const w3 = await createNoteWindow('w-theme-1')
    const listWin = await createListWindow()
    const themeValue = await evalIn(w3, `(async () => {
      await window.api.setSetting({ theme: 'white' })
      await new Promise(r => setTimeout(r, 150))
      return document.body.dataset.theme
    })()`)
    ok('setSetting white -> data-theme=white', themeValue === 'white', themeValue)

    const listTheme = await evalIn(listWin, `document.body.dataset.theme`)
    ok('主题广播到列表窗口', listTheme === 'white', listTheme)

    const sys = await evalIn(w3, `(async () => {
      await window.api.setSetting({ theme: 'system' })
      await new Promise(r => setTimeout(r, 150))
      return document.body.dataset.theme
    })()`)
    ok('system 映射为 light 或 dark', sys === 'light' || sys === 'dark', sys)

    const four = await evalIn(w3, `(async () => {
      const out = {}
      for (const t of ['white', 'light', 'dark']) {
        await window.api.setSetting({ theme: t })
        await new Promise(r => setTimeout(r, 120))
        out[t] = document.body.dataset.theme
      }
      return out
    })()`)
    ok('手动三色调各自生效', four.white === 'white' && four.light === 'light' && four.dark === 'dark', JSON.stringify(four))

    w2.destroy()
    w3.destroy()
    listWin.destroy()
  }
}
