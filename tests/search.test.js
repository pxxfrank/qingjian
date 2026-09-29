// 全文搜索链路测试：search:query 契约 + 列表搜索结果视图 + 快速搜索面板
module.exports = {
  name: 'search',
  run: async (h) => {
    const { ok, createListWindow, createQuickFindWindow, evalIn, sleep, getStore, getLastOpened } = h
    const store = getStore()
    store.writeNote('s-title', { title: '会议纪要', html: '<p>无关内容</p>', preview: '无关内容', createdAt: 1000, color: 'blue' })
    store.writeNote('s-body', { title: '随手记', html: '<p>今天讨论了会议纪要与排期</p>', preview: '今天讨论了会议纪要与排期', createdAt: 2000, color: 'green' })
    store.writeNote('s-none', { title: '购物清单', html: '<p>牛奶 鸡蛋</p>', preview: '牛奶 鸡蛋', createdAt: 3000, color: 'pink' })

    const win = await createListWindow()

    console.log('\n[search] search:query 契约')
    const res = await evalIn(win, `window.api.searchNotes('会议纪要')`)
    ok('正文命中也能搜到（标题 + 正文共 2 条）', Array.isArray(res) && res.length === 2, JSON.stringify(res && res.map((r) => r.id)))
    ok('标题命中者优先返回', res[0] && res[0].id === 's-title', JSON.stringify(res && res.map((r) => r.id)))
    const bodyHit = (res.find((r) => r.id === 's-body') || {}).matches || []
    ok('正文命中标记 field=body', bodyHit.some((m) => m.field === 'body'), JSON.stringify(bodyHit))
    ok('片段为纯文本（不含 HTML 标签）', bodyHit.every((m) => typeof m.snippet === 'string' && !m.snippet.includes('<')), JSON.stringify(bodyHit))
    ok('每条结果含 id/title/color/updatedAt/count/matches', res.every((r) =>
      r.id && typeof r.title === 'string' && typeof r.color === 'string' &&
      typeof r.updatedAt === 'number' && typeof r.count === 'number' && Array.isArray(r.matches)))
    ok('未命中的便笺不返回', !res.some((r) => r.id === 's-none'))
    const emptyRes = await evalIn(win, `window.api.searchNotes('   ')`)
    ok('空 query 返回空数组', Array.isArray(emptyRes) && emptyRes.length === 0)

    console.log('\n[search] 列表窗搜索结果视图')
    await evalIn(win, `(() => { const i = document.getElementById('searchInput'); i.value = '会议纪要'; i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    await sleep(320)
    const sr = await evalIn(win, `({
      items: document.querySelectorAll('.sr-item').length,
      marks: document.querySelectorAll('mark.sr-mark').length,
      count: document.querySelector('.sr-count') ? document.querySelector('.sr-count').textContent : ''
    })`)
    ok('渲染搜索结果条目', sr.items === 2, JSON.stringify(sr))
    ok('命中片段用 <mark> 高亮', sr.marks >= 1, JSON.stringify(sr))
    ok('显示命中数', /处/.test(sr.count), sr.count)

    await evalIn(win, `document.querySelector('.sr-item').click()`)
    await sleep(80)
    const opened = getLastOpened()
    ok('点击结果打开便笺并带高亮查询', opened && opened.id === 's-title' && opened.q === '会议纪要', JSON.stringify(opened))

    // 清空搜索 → 回到正常列表（DOM 契约不受影响）
    await evalIn(win, `(() => { const i = document.getElementById('searchInput'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    await sleep(120)
    const cleared = await evalIn(win, `({ sr: document.querySelectorAll('.sr-item').length, cards: document.querySelectorAll('.note-card').length })`)
    ok('清空搜索回到正常列表', cleared.sr === 0 && cleared.cards === 3, JSON.stringify(cleared))

    console.log('\n[search] 快速搜索面板')
    const qf = await createQuickFindWindow()
    const emptyHint = await evalIn(qf, `document.querySelector('.qf-empty') ? document.querySelector('.qf-empty').textContent.trim() : ''`)
    ok('空 query 显示提示', emptyHint.length > 0, emptyHint)
    await evalIn(qf, `(() => { const i = document.querySelector('.qf-input'); i.value = '会议纪要'; i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    await sleep(320)
    const qfRes = await evalIn(qf, `({
      items: document.querySelectorAll('.qf-item').length,
      marks: document.querySelectorAll('mark.qf-mark').length,
      active: [...document.querySelectorAll('.qf-item')].findIndex((el) => el.classList.contains('on'))
    })`)
    ok('面板渲染结果并高亮', qfRes.items === 2 && qfRes.marks >= 1, JSON.stringify(qfRes))
    ok('默认选中第一条', qfRes.active === 0, JSON.stringify(qfRes))

    await evalIn(qf, `document.querySelector('.qf-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))`)
    await sleep(60)
    const afterDown = await evalIn(qf, `[...document.querySelectorAll('.qf-item')].findIndex((el) => el.classList.contains('on'))`)
    ok('↑↓ 切换选中项', afterDown === 1, 'active=' + afterDown)

    await evalIn(qf, `document.querySelector('.qf-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`)
    await sleep(80)
    const chosen = getLastOpened()
    ok('回车打开选中便笺（带高亮查询）', chosen && chosen.id === 's-body' && chosen.q === '会议纪要', JSON.stringify(chosen))

    const escOk = await evalIn(qf, `(() => { document.querySelector('.qf-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return true })()`)
    ok('Esc 关闭面板不报错', escOk === true)

    qf.destroy()
    win.destroy()
  }
}
