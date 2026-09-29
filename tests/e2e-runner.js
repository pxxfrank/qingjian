// E2E 测试主入口（electron tests/e2e-runner.js）
const { app } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const helpers = require('./helpers')

const modules = [
  require('./engine.test'),
  require('./keyboard.test'),
  require('./listpage.test'),
  require('./launcher.e2e.test'),
  require('./window.test'),
  require('./features.test'),
  require('./search.test'),
  require('./today.e2e.test')
]

// 测试各模块会反复创建/销毁窗口，须阻止 Electron 默认的「窗口全关即退出」
app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  helpers.registerIpc()

  for (const m of modules) {
    // 每个模块独立临时存储，避免模块间数据污染
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-md-e2e-'))
    helpers.initStore(tmp)
    console.log('\n=== ' + m.name + ' ===')
    try {
      await m.run(helpers)
    } catch (err) {
      console.error('  MODULE ERROR:', (err && err.stack) || err)
      helpers.stats.fail++
      helpers.stats.failures.push(m.name + ' (exception)')
    }
    fs.rmSync(tmp, { recursive: true, force: true })
  }

  const s = helpers.stats
  console.log(`\n=== E2E 汇总: ${s.pass} 通过, ${s.fail} 失败 ===`)
  if (s.failures.length) {
    console.log('失败用例:')
    for (const f of s.failures) console.log('  - ' + f)
  }

  app.exit(s.fail === 0 ? 0 : 1)
})
