// 今日看板端到端测试：today:list 契约 / 看板视图渲染 / 勾选回写不打断编辑 / 未开便笺回写 / 跳转定位
module.exports = {
  name: 'today',
  run: async (h) => {
    const {
      ok, createNoteWindow, createListWindow, evalIn, sleep,
      getStore, getApplyTaskEvents
    } = h
    const store = getStore()

    const todayAt = (() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d.getTime() })()
    const tomorrowAt = todayAt + 24 * 3600 * 1000
    const now = Date.now()

    store.writeNote('t-open', {
      title: '今天要做',
      color: 'green',
      html: '<ul><li class="checkbox">买菜</li><li class="checkbox checked">已完成</li><li class="checkbox">遛狗</li></ul>',
      remind: [
        { id: 'r1', at: todayAt, repeat: 'daily', done: false },
        { id: 'r2', at: tomorrowAt, repeat: 'once', done: false }
      ],
      createdAt: now
    })
    store.writeNote('t-closed', {
      title: '未打开',
      color: 'blue',
      html: '<ul><li class="checkbox">写周报</li></ul>',
      createdAt: now + 1
    })
    store.writeNote('t-empty', { title: '空的', html: '<p>无任务</p>', createdAt: now + 2 })

    const noteWin = await createNoteWindow('t-open')
    const listWin = await createListWindow()

    console.log('\n[today] today:list 契约')
    const board = await evalIn(listWin, `window.api.todayList()`)
    ok('按便笺分组返回（仅 tasks/reminders 非空）', Array.isArray(board) && board.length === 2, JSON.stringify(board && board.map((g) => g.id)))
    const gOpen = board.find((g) => g.id === 't-open')
    ok('tasks 仅未勾选且保留 index/text',
      gOpen.tasks.length === 2 && gOpen.tasks[0].index === 0 && gOpen.tasks[0].text === '买菜' && gOpen.tasks[1].index === 2 && gOpen.tasks[1].text === '遛狗',
      JSON.stringify(gOpen.tasks))
    ok('reminders 仅今天未完成项', gOpen.reminders.length === 1 && gOpen.reminders[0].at === todayAt, JSON.stringify(gOpen.reminders))
    ok('分组含 id/title/color', gOpen.id === 't-open' && gOpen.title === '今天要做' && gOpen.color === 'green')
    ok('未打开但有待办也返回', board.some((g) => g.id === 't-closed'))
    ok('无待办便笺不返回', !board.some((g) => g.id === 't-empty'))

    console.log('\n[today] 看板视图渲染')
    await evalIn(listWin, `window.api.openToday()`)
    await sleep(220)
    const dom = await evalIn(listWin, `({
      board: !!document.getElementById('todayBoard'),
      groups: document.querySelectorAll('#todayBoard .t-group').length,
      tasks: document.querySelectorAll('#todayBoard .t-task').length,
      reminds: document.querySelectorAll('#todayBoard .t-remind').length,
      brand: document.querySelector('.brand') ? document.querySelector('.brand').textContent.trim() : ''
    })`)
    ok('view=today 显示看板容器', dom.board === true, JSON.stringify(dom))
    ok('渲染便笺分组（2 组）', dom.groups === 2, JSON.stringify(dom))
    ok('渲染未勾选任务（买菜/遛狗 + 写周报 = 3）', dom.tasks === 3, JSON.stringify(dom))
    ok('渲染今日提醒', dom.reminds === 1, JSON.stringify(dom))
    ok('标题栏切换到今日看板', dom.brand.includes('今日看板'), dom.brand)

    console.log('\n[today] 勾选回写：不打断正在编辑的便笺（关键用例）')
    const sentinel = await evalIn(noteWin, `(() => {
      const ed = document.getElementById('editor')
      const li = ed.querySelectorAll('li.checkbox')[2] // 遛狗（未勾选）
      li.setAttribute('data-sentinel', 'S')
      window.__liNode = li
      window.__edFirst = ed.firstElementChild
      return { count: ed.querySelectorAll('li.checkbox').length, checked: li.className.includes('checked') }
    })()`)
    ok('便笺窗已加载任务（遛狗未勾选）', sentinel.count === 3 && sentinel.checked === false, JSON.stringify(sentinel))

    await evalIn(listWin, `(() => {
      const row = [...document.querySelectorAll('#todayBoard .t-task')].find((r) => r.textContent.includes('遛狗'))
      row.querySelector('.t-check').click()
    })()`)
    await sleep(700) // 覆盖渲染层 400ms 防抖保存

    const after = await evalIn(noteWin, `(() => {
      const ed = document.getElementById('editor')
      const li = ed.querySelectorAll('li.checkbox')[2]
      return {
        checked: li.className.includes('checked'),
        sameNode: window.__liNode === li,
        sentinelKept: li.getAttribute('data-sentinel'),
        sameEditorChild: window.__edFirst === ed.firstElementChild
      }
    })()`)
    ok('看板勾选 → 便笺对应 li 的 checked 变化', after.checked === true, JSON.stringify(after))
    ok('原地切换：同一 li 节点未被替换（哨兵保留）', after.sameNode === true && after.sentinelKept === 'S', JSON.stringify(after))
    ok('编辑器根子节点未被整体替换', after.sameEditorChild === true)

    const ev = getApplyTaskEvents()
    ok('主进程下发 note:apply-task（text 定位 + checked）', ev.some((e) => e && e.text === '遛狗' && e.checked === true), JSON.stringify(ev))

    await sleep(150)
    const board2 = await evalIn(listWin, `window.api.todayList()`)
    const g2 = board2.find((g) => g.id === 't-open')
    ok('勾选落盘后看板不再列出该任务', g2 && !g2.tasks.some((t) => t.text === '遛狗'), JSON.stringify(g2 && g2.tasks))

    console.log('\n[today] 便笺未打开时的回写')
    await evalIn(listWin, `window.api.todayToggle({ noteId: 't-closed', taskIndex: 0, taskText: '写周报', checked: true })`)
    await sleep(150)
    const closedNote = store.readNote('t-closed')
    ok('未打开便笺：主进程直接 toggleTask 落盘', !!(closedNote && closedNote.html.includes('checkbox checked')), closedNote && closedNote.html)
    ok('未打开便笺不下发 note:apply-task', !getApplyTaskEvents().some((e) => e && e.text === '写周报'))
    const board3 = await evalIn(listWin, `window.api.todayList()`)
    ok('未打开便笺勾选后从看板移除', !board3.some((g) => g.id === 't-closed'), JSON.stringify(board3 && board3.map((g) => g.id)))

    console.log('\n[today] 点击条目文字跳转定位（flash）')
    await evalIn(listWin, `(() => {
      const row = [...document.querySelectorAll('#todayBoard .t-task')].find((r) => r.textContent.includes('买菜'))
      row.querySelector('.t-text').click()
    })()`)
    await sleep(320)
    const rev = await evalIn(noteWin, `({
      flash: document.querySelectorAll('#editor li.flash').length,
      onTa: (() => { const li = [...document.querySelectorAll('#editor li.checkbox')].find((n) => n.textContent.includes('买菜')); return li ? li.classList.contains('flash') : false })()
    })`)
    ok('点击条目文字 → 便笺对应任务临时高亮', rev.flash >= 1 && rev.onTa === true, JSON.stringify(rev))

    // 触发一次真实保存，确认 flash 纯视觉 class 不会写入便笺内容
    await evalIn(noteWin, `(() => {
      const ed = document.getElementById('editor')
      ed.dispatchEvent(new InputEvent('input', { bubbles: true }))
      ed.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }))
    })()`)
    await sleep(200)
    const savedHtml = (store.readNote('t-open') || {}).html || ''
    ok('flash class 不写入便笺内容', !savedHtml.includes('flash'), savedHtml)

    console.log('\n[today] 从 logo 菜单返回便笺列表')
    const backToday = await evalIn(listWin, `(async () => {
      window.api.openToday()
      await new Promise(r => setTimeout(r, 150))
      const inToday = !!document.getElementById('todayBoard')
      const noBackBtn = !document.getElementById('backBtn')
      document.getElementById('brandBtn').click()
      await new Promise(r => setTimeout(r, 80))
      const item = [...document.querySelectorAll('.menu .menu-item')].find((b) => b.textContent.includes('返回便笺列表'))
      const hasItem = !!item
      if (item) item.click()
      await new Promise(r => setTimeout(r, 150))
      return { inToday, noBackBtn, hasItem, backToNotes: !!document.getElementById('noteGrid') && !document.getElementById('todayBoard') }
    })()`)
    ok('今日看板：无左上角返回键，logo 菜单有「返回便笺列表」且可回到主界面',
      backToday.inToday === true && backToday.noBackBtn === true && backToday.hasItem === true && backToday.backToNotes === true, JSON.stringify(backToday))

    const backTrash = await evalIn(listWin, `(async () => {
      document.getElementById('brandBtn').click()
      await new Promise(r => setTimeout(r, 80))
      ;[...document.querySelectorAll('.menu .menu-item')].find((b) => b.textContent.includes('回收站')).click()
      await new Promise(r => setTimeout(r, 150))
      const inTrash = !!document.getElementById('trashGrid')
      const noBackBtn = !document.getElementById('backBtn')
      document.getElementById('brandBtn').click()
      await new Promise(r => setTimeout(r, 80))
      const item = [...document.querySelectorAll('.menu .menu-item')].find((b) => b.textContent.includes('返回便笺列表'))
      const hasItem = !!item
      if (item) item.click()
      await new Promise(r => setTimeout(r, 150))
      return { inTrash, noBackBtn, hasItem, backToNotes: !!document.getElementById('noteGrid') }
    })()`)
    ok('回收站：无左上角返回键，logo 菜单有「返回便笺列表」且可回到主界面',
      backTrash.inTrash === true && backTrash.noBackBtn === true && backTrash.hasItem === true && backTrash.backToNotes === true, JSON.stringify(backTrash))

    noteWin.destroy()
    listWin.destroy()
  }
}
