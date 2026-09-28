// 新功能端到端测试：便笺内查找 / 回收站 / 关闭前保存兜底
module.exports = {
  name: 'features',
  run: async (h) => {
    const { ok, createNoteWindow, createListWindow, evalIn, sleep, getStore, typeText } = h
    const store = getStore()

    console.log('\n[features] 便笺内查找（Ctrl+F）')
    const win = await createNoteWindow('f-find')
    await typeText(win, '查找目标词')
    const opened = await evalIn(win, `(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))
      return !!document.querySelector('.findbar')
    })()`)
    await sleep(120)
    const hasBar = await evalIn(win, `!!document.querySelector('.findbar')`)
    ok('Ctrl+F 打开查找条', opened === true || hasBar === true, `opened=${opened} has=${hasBar}`)
    const closed = await evalIn(win, `(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return new Promise(r => setTimeout(() => r(!document.querySelector('.findbar')), 100))
    })()`)
    ok('Esc 关闭查找条', closed === true)

    console.log('\n[features] 回收站（删除可恢复）')
    const listWin = await createListWindow()
    store.writeNote('f-trash', { title: '将被删除', html: '<p>x</p>', preview: 'x', createdAt: Date.now(), color: 'green' })
    await evalIn(listWin, `window.dispatchEvent(new Event('focus'))`)
    await evalIn(listWin, `(() => { /* 触发刷新 */ })()`)
    await sleep(200)
    const trashBefore = store.trashCount()
    await evalIn(listWin, `window.api.deleteNote('f-trash')`)
    await sleep(200)
    const inTrash = store.listTrash().some((t) => t.id === 'f-trash')
    ok('删除后进入回收站', inTrash === true && store.trashCount() === trashBefore + 1)
    ok('删除后便笺列表移除', store.readNote('f-trash') === null)
    await evalIn(listWin, `window.api.restoreTrash('f-trash')`)
    await sleep(200)
    ok('恢复后回到列表', store.readNote('f-trash') !== null && store.trashCount() === trashBefore)

    console.log('\n[features] 主题一致性（暗色模式跟随）')
    await evalIn(listWin, `window.api.setSetting({ theme: 'dark' })`)
    await sleep(800) // 背景色有 250ms 过渡，采样要等它走完
    const darkProbe = await evalIn(listWin, `(() => {
      const pick = (sel) => {
        const cs = getComputedStyle(document.querySelector(sel)).backgroundColor
        let rgb = null
        const m1 = cs.match(/^rgba?\\(([^)]+)\\)/)
        const m2 = cs.match(/^color\\(srgb ([^)]+)\\)/)
        if (m1) rgb = m1[1].split(',').slice(0, 3).map(parseFloat)
        else if (m2) rgb = m2[1].split(/\\s+/).slice(0, 3).map((v) => parseFloat(v) * 255)
        return rgb ? rgb.reduce((a, b) => a + b, 0) : 999
      }
      return {
        theme: document.body.dataset.theme,
        body: pick('body'),
        app: pick('#app'),
        head: pick('.head'),
        card: pick('.note-card')
      }
    })()`)
    const darkOk = Object.values(darkProbe).every((v) => typeof v === 'number' ? v < 240 : v === 'dark')
    ok('暗色模式下窗口/顶栏/卡片全部变深', darkProbe.theme === 'dark' && darkProbe.body < 240 &&
      darkProbe.app < 240 && darkProbe.head < 240 && darkProbe.card < 240, JSON.stringify(darkProbe))
    await evalIn(listWin, `window.api.setSetting({ theme: 'light' })`)
    await sleep(150)

    console.log('\n[features] 窗口直角 + 立体阴影')
    const shape = await evalIn(win, `(() => {
      const cs = getComputedStyle(document.body)
      const appCs = getComputedStyle(document.getElementById('app'))
      return { radius: cs.borderRadius, padding: cs.paddingTop, shadow: appCs.boxShadow }
    })()`)
    ok('窗口为直角', shape.radius === '0px', JSON.stringify(shape))
    ok('纸面带投影（立体感）', shape.shadow && shape.shadow !== 'none', shape.shadow)
    ok('窗口内留出投影空间', parseFloat(shape.padding) >= 8, shape.padding)

    console.log('\n[features] 便笺标题不被图标吞没')
    // 使用真实最小宽度（main.js NOTE_MIN_W = 380）
    await evalIn(win, `window.api.setBounds({ x: 40, y: 40, width: 380, height: 260 })`)
    await sleep(300)
    const titleFit = await evalIn(win, `(() => {
      const input = document.querySelector('.title-input')
      const btns = [...document.querySelectorAll('.titlebar .ctrl')]
      const bar = document.querySelector('.titlebar')
      return {
        titleW: input.getBoundingClientRect().width,
        btnCount: btns.length,
        overflow: btns.some((b) => b.getBoundingClientRect().right > bar.getBoundingClientRect().right + 1),
        clipped: btns.some((b) => b.getBoundingClientRect().width < 20)
      }
    })()`)
    ok('最小宽度下标题仍有横向空间', titleFit.titleW >= 90, JSON.stringify(titleFit))
    ok('标题栏图标全部可见未被裁切', titleFit.overflow === false && titleFit.clipped === false, JSON.stringify(titleFit))

    console.log('\n[features] 标题栏/工具栏随笔笺纸色变化')
    const chromeColors = await evalIn(win, `(() => {
      const bar = document.querySelector('.titlebar')
      const out = {}
      for (const c of ['yellow', 'blue']) {
        document.body.dataset.color = c
        out[c] = getComputedStyle(bar).backgroundColor
      }
      document.body.dataset.color = 'white'
      return out
    })()`)
    ok('标题栏底色随笔笺颜色改变', chromeColors.yellow !== chromeColors.blue, JSON.stringify(chromeColors))

    console.log('\n[features] 收起小球后能再打开（无缩放动画残留）')
    const dockWin = await createNoteWindow('f-dock')
    dockWin.show()
    await sleep(300)
    await evalIn(dockWin, `window.api.hideToDock()`)
    await sleep(300)
    ok('收起后窗口隐藏', dockWin.isVisible() === false)
    await evalIn(dockWin, `window.api.openNote('f-dock')`)
    await sleep(400)
    ok('从小球再打开时窗口可见', dockWin.isVisible() === true)
    const reopened = await evalIn(dockWin, `({
      cls: document.body.className,
      opacity: getComputedStyle(document.body).opacity,
      transform: getComputedStyle(document.body).transform
    })`)
    const noResidue = reopened.opacity === '1' &&
      (reopened.transform === 'none' || reopened.transform === 'matrix(1, 0, 0, 1, 0, 0)')
    ok('复原后无残留缩放/透明', noResidue, JSON.stringify(reopened))
    dockWin.destroy()

    console.log('\n[features] 便笺列表可打开')
    const listProbe = await createListWindow()
    listProbe.show()
    await sleep(250)
    await evalIn(listProbe, `window.api.hideToDock()`)
    await sleep(300)
    ok('列表收起后隐藏', listProbe.isVisible() === false)
    await evalIn(listProbe, `window.api.openList()`)
    await sleep(400)
    ok('点击便笺列表能打开窗口', listProbe.isVisible() === true)
    listProbe.destroy()

    console.log('\n[features] 关闭窗口前的保存兜底')
    const flushWin = await createNoteWindow('f-flush')
    await typeText(flushWin, '关闭前必须保存的内容')
    await sleep(120) // 小于 400ms 去抖：此刻尚未落盘
    const saved = store.readNote('f-flush')
    const dirty = !saved || !saved.html || !saved.html.includes('必须保存')
    flushWin.close()
    await sleep(400)
    const after = store.readNote('f-flush')
    ok('关闭窗口会 flush 未落盘的编辑', !!(after && after.html && after.html.includes('必须保存')), `dirty=${dirty}`)

    listWin.destroy()
  }
}
