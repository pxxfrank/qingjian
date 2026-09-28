// 便笺列表页测试
module.exports = {
  name: 'listpage',
  run: async (h) => {
    const { ok, createListWindow, evalIn, sleep, getStore } = h
    const store = getStore()
    store.writeNote('n1', { title: '第一张', html: '<p>一</p>', preview: '一', createdAt: Date.now() - 1000, color: 'blue' })
    store.writeNote('n2', { title: '<script>alert(1)</script>', html: '<p>二</p>', preview: '二', createdAt: Date.now() - 2000, color: 'green' })

    const win = await createListWindow()

    console.log('\n[listpage] 渲染 / 搜索 / 增删')
    const cardCount = await evalIn(win, `document.querySelectorAll('.note-card').length`)
    ok('渲染便笺卡片数量', cardCount === 2, 'count=' + cardCount)

    const xss = await evalIn(win, `({
      scriptCount: document.querySelectorAll('#noteGrid script').length,
      firstTitle: document.querySelector('.note-card .title') ? document.querySelector('.note-card .title').textContent : ''
    })`)
    ok('XSS 转义（无 script 元素）', xss.scriptCount === 0 && xss.firstTitle.includes('<script>'), JSON.stringify(xss))

    const colorDot = await evalIn(win, `document.querySelector('.note-card .color-dot') ? true : false`)
    ok('卡片显示颜色圆点', colorDot === true)

    await evalIn(win, `(() => { const i = document.getElementById('searchInput'); i.value = '第一'; i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    await sleep(50)
    const filteredCount = await evalIn(win, `document.querySelectorAll('.note-card').length`)
    ok('搜索过滤', filteredCount === 1, 'count=' + filteredCount)

    await evalIn(win, `(() => { const i = document.getElementById('searchInput'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    await sleep(50)

    const before = store.listNotes().length
    await evalIn(win, `document.getElementById('newBtn').click()`)
    await sleep(300)
    const after = store.listNotes().length
    ok('新建便笺写入存储', after === before + 1, `${before} -> ${after}`)

    await evalIn(win, `(() => { const d = document.querySelector('.note-card .del'); d.click(); d.click() })()`)
    await sleep(300)
    const afterDel = store.listNotes().length
    ok('删除便笺移除存储', afterDel === after - 1, `${after} -> ${afterDel}`)

    console.log('\n[listpage] 主题 / 时间')
    const icons = await evalIn(win, `(async () => {
      const btn = document.getElementById('themeBtn')
      const seen = []
      for (let i = 0; i < 4; i++) { btn.click(); await new Promise(r => setTimeout(r, 80)); seen.push(btn.getAttribute('title')) }
      return seen
    })()`)
    ok('主题按钮四态循环（title 依次变化）', new Set(icons).size === 4, JSON.stringify(icons))

    const timeText = await evalIn(win, `document.querySelector('.note-card .time') ? document.querySelector('.note-card .time').textContent : ''`)
    ok('渲染时间文本', timeText.length > 0, timeText)

    console.log('\n[listpage] 窗口控制（最小化 / 关闭）')
    win.show()
    await sleep(150)
    await evalIn(win, `document.getElementById('minBtn').click()`)
    await sleep(250)
    ok('最小化按钮生效', win.isMinimized() === true)
    if (win.isMinimized()) win.restore()
    await sleep(150)
    await evalIn(win, `document.getElementById('closeBtn').click()`)
    await sleep(250)
    ok('关闭按钮关闭窗口', win.isDestroyed() === true)
    if (!win.isDestroyed()) win.destroy()
  }
}
