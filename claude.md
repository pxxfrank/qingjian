# CLAUDE.md

本文件为 Claude Code（或同类 AI 编码助手）在此仓库工作时的指引。

## 项目概述

**轻笺（QingJian）** — 轻量级 Windows 便笺应用。Electron（主进程）+ Vue 3 + Vite（渲染层，多页：list / note / launcher / capture）。
核心能力：Markdown 所见即所得（打字即时渲染）、贴边启动器（收进边缘小球）、全局热键速记条、回收站、悬浮置顶、暗夜模式、便笺列表管理。

- 运行时依赖：仅 `electron`（`^43`）；打包后的 `app.asar` 不含任何 `node_modules`
- 目标平台：Windows（`win32`）
- 命名（全仓统一）：`name=qingjian`、`productName=轻笺`、`appId=com.qingjian.note`、安装包 `轻笺-Setup-${version}.exe`、可执行文件 `轻笺.exe`
- `productName`（`轻笺`）决定 userData 目录 `%APPDATA%\轻笺\`；**所有数据只在该目录，绝不进安装包**（详见「打包与代码签名」）

## 常用命令

```bash
npm install              # 安装依赖（依赖 .npmrc 镜像，见「已知问题」）
npm run build            # 构建前端（Vite，产出 frontend/dist/）
npm start                # 启动应用（加载 frontend/dist 构建产物，需先 build）
npm test                 # 构建前端 + 存储层/启动器几何单测 + E2E 测试
npm run dist             # 构建 + 数字签名 + 打包 Windows 安装包（自动确保有证书）
npm run dist:unsigned    # 只打包、不签名
npm run cert:dev         # 只生成自签名开发证书
```

代码修改后建议先 `node --check <file>` 做语法检查，再跑 `npm test`。

## 架构

标准 Electron 三进程模型，安全隔离：

```
main.js      主进程：窗口管理、IPC、存储、托盘、单例锁
preload.js   预加载：contextBridge 暴露 window.api（contextIsolation: true, nodeIntegration: false）
store.js     存储层（纯 Node，可独立测试）
launcher-geometry.js  贴边启动器几何计算（纯 Node，可独立测试）
launcher.js           贴边启动器窗口控制器（主进程，依赖 electron screen）
frontend/    Vue3 + Vite 多页工程（构建产物 frontend/dist/，main.js 加载该产物）
  list/      便笺列表页入口（App.vue + main.js）
  note/      便笺编辑页入口（App.vue + main.js）
  launcher/  贴边启动器入口（App.vue + main.js）
  src/editor/engine.js  WYSIWYG 引擎（从旧 renderer/note.js 平移）
  src/components/       TitleBar / NoteCard / ColorPicker / EditorToolbar / Icon
  src/styles/base.css   全局样式（圆角窗口/滚动条/resize 手柄/编辑器）
```

### 窗口

- **列表窗口**：`createListWindow()`，无边框透明圆角窗口（自绘标题栏：品牌 + 主题/新建/最小化/关闭），关闭即退出应用（`window-all-closed` → quit）。
- **便笺窗口**：`createNoteWindow(id, bounds)`，`frame: false` + `transparent: true` + `alwaysOnTop: true`（默认置顶）。
  关闭时（`close` 事件）保存 `bounds{x,y,width,height}` 用于下次恢复；`closed` 事件清理 `noteWins` Map。
- 两个窗口均用 CSS 圆角 + 自绘 resize 手柄（`.rz`，透明窗口在 Windows 上系统 resize 失效），窗口拖拽靠 `-webkit-app-region: drag`。
- **贴边启动器**：独立窗口 `createLauncherWindow()`（`launcher.js` 控制器驱动），`frame:false + transparent + alwaysOnTop + skipTaskbar + movable:false`，吸在屏幕左/右边缘。小球**常驻显示**（`refreshLauncher()` 始终 `show()`，除非退出程序）；横条内容 = `☰ 列表 + 被收起的窗口 + ＋ 新建`；窗口 `closed` 时控制器 `destroy()`。
- 单例锁：`requestSingleInstanceLock()`，二次启动聚焦列表窗口。

### IPC 契约

`preload.js` 通过 `contextBridge` 暴露 `window.api`，渲染层只能用这些方法，**不得在渲染层直接使用 Node API**。

| window.api 方法 | IPC 通道 | 说明 |
|---|---|---|
| `listNotes()` | `notes:list` | 返回便笺元信息数组（title/preview/pinned/updatedAt） |
| `readNote(id)` | `note:read` | 读取单条便笺完整数据 |
| `saveNote(id, payload)` | `note:save` | 保存并广播 `notes:changed` 给列表窗口 |
| `createNote()` | `note:create` | 新建空便笺，返回 id |
| `deleteNote(id)` | `note:delete` | 删除文件 + 关闭对应窗口 |
| `openNote(id)` | `window:open-note` | 打开或聚焦便笺窗口 |
| `setAlwaysOnTop(flag)` | `window:set-always-on-top` | 切换置顶 |
| `hideToDock()` | `window:hide-to-dock` | 收起到贴边：把当前窗口收进小球（含缩小动画） |
| `setLauncherEdge(mode)` | `launcher:set-edge` | 设置贴边位置 `'left'`/`'right'` |
| `getLauncher()` | `launcher:get` | 读取启动器状态（edge/expanded/visible/count） |
| `getLauncherItems()` | `launcher:items` | 读取小球内容（被收起的便笺 + 列表） |
| `openList()` | `launcher:open-list` | 启动器：打开便笺列表 |
| `launcherCreateNote()` | `launcher:create-note` | 启动器：新建便笺并打开 |
| `launcherDragStart/Move/End(x, y)` | `launcher:drag-*` | 启动器拖动（屏幕 X 决定贴左/右，Y 决定纵向位置） |
| `minimize()` / `closeWindow()` | `window:minimize` / `window:close` | 无边框窗口控制 |
| `getBounds()` / `setBounds(b)` | `window:get-bounds` / `window:set-bounds` | 自绘 resize 手柄 |
| `pickImage()` | `image:pick` | 打开文件对话框选图并返回 base64 data URL |
| `getSettings()` / `setSetting(patch)` | `settings:get` / `settings:set` | 主题设置，setSetting 会广播 `theme:changed` |
| `onNotesChanged` / `onThemeChanged` / `onLauncherState` / `onLauncherItems` / `onDockShrink` / `onWindowReset` | — | 订阅主进程推送事件 |

新增 IPC 时须同步修改三处：`main.js`（handler）→ `preload.js`（暴露）→ 渲染层调用。

### 数据存储

- 目录：`%APPDATA%\轻笺\notes\`（由 `app.getPath('userData')` 推导）
- 每张便笺一个 JSON 文件 `{id}.json`，字段：
  `{ id, title, html, preview, createdAt, updatedAt, bounds, pinned, color }`
  - `html`：编辑器 `innerHTML`（存储的是富文本 HTML，不是 Markdown 源码）
  - `title`/`preview`：列表页展示用（纯文本，须转义后渲染）
- 设置：`%APPDATA%\轻笺\settings.json`，字段 `{ theme, launcher, launcherY }`
  - `theme`：`'system' | 'white' | 'light' | 'dark'`
  - `launcher`：贴边启动器所在边 `'right'`（默认）/`'left'`
  - `launcherY`：启动器垂直中心（纵向拖动后记忆；缺省 = 工作区居中）

## WYSIWYG Markdown 引擎（frontend/src/editor/engine.js）

核心设计是**渐进式转换**：不整篇解析 Markdown，只在「光标位于行尾」时触发转换，因此代码轻量、无需完整解析器。

关键函数：

- `BLOCK_PATTERNS` + `convertBlock(block)`：行首符号转换
  `# `→h1-6、`- `/`* `/`+ `→ul、`1. `→ol（`start` 属性）、`[] `/`[x] `→`li.checkbox`、`> `→blockquote
- `INLINE_PATTERNS` + `convertInline(node)`：行内闭合符号转换
  `**加粗**`→strong、`*斜*`→em、`__下划线__`→u、`~~删除~~`→del、`` `代码` ``→code
  （模式顺序即优先级；`**` 须在 `*` 前，`__` 须在 `_` 前）
- `textNodeAtCaret()`：selection 可能停在元素边界而非文本节点，须向下定位到文本节点（见「已知问题」）
- `handleEnter(block)`：列表内回车自动延续（checkbox 延续 checkbox、ol 自动编号）、空列表项回车退出列表
- `handleBackspace(e)`：空列表项开头退格退出列表
- `normalize()`：把裸 `div` 和 editor 直接子节点中的裸文本规范为 `p`（每次 `input` 都调用，保证块结构统一）
- 复选框：`li.checkbox` 用 CSS `::before` 绘制，点击 toggle `checked` 类，存储靠 class 而非 `<input>`

事件流程：`input` → `normalize()` → 块级转换 → 行内转换 → `scheduleSave()`（400ms 防抖）。

## 贴边启动器（launcher.js / launcher-geometry.js）

- **模型**：便笺/列表默认都是普通窗口，**只有点了 ⇲ 收起的窗口才进入小球**（`main.js` 的 `minimizedNotes: Set` / `listMinimized: bool`）。**小球常驻**——`refreshLauncher()` 始终 `launcherCtrl.show()`，并把横条内容通过 `launcher:items` 推给渲染层。
- `launcher-geometry.js`：**纯几何**（无 electron 依赖）。`ballBounds`（窗口中心压在屏幕边缘 → 只露半个小球）、`barWidth`/`barBounds`（横条宽度随图标数增长、超宽封顶）、`ballReveal`（小球鼠标热区）、`clampCenterY`（纵向夹取）、`pointInRect`/`pointInBounds`。可直接 `node tests/launcher.test.js` 单测。
- `launcher.js`：**窗口控制器** `createLauncher(win, opts)`，单例（由 `main.js` 的 `createLauncherWindow` 创建）。职责：
  - `show()`：常驻显示小球（控制器已无 `hide`）。
  - `setEdge('left'|'right')`、`setCount(n)`、`setY(y)` / `getY()`、`getAnchor()`（小球在世界坐标的锚点，供收起动画定位）。
  - 轮询 `step()`：收起态下光标进入 `ballReveal` → 延迟 `expandDelay` 后**展开成横条**（让小球先高亮）；展开态下「**光标离开横条且未聚焦**」→ 延迟 `collapseDelay` 后**收回小球**。
  - `dragStart/DragMove/dragEnd(屏幕 X, Y)`：**X 落在屏幕哪半屏就贴哪边**（实时换边）、Y 决定纵向位置；`dragging` 期间不展开/不收回；`main.js` 在 `drag-end` 时把 `launcherY` + `launcher` 写进 settings。
  - 用 `screen.getCursorScreenPoint()` / `screen.getDisplayMatching(win.getBounds()).workArea`；`getCursor`/`getWorkArea`/`isFocused`/`expandDelay`/`collapseDelay`/`pollInterval` 均可注入 → `tests/launcher.e2e.test.js` 手动 `step()` 确定性驱动。
- 渲染层 `frontend/launcher/App.vue`：`launcher:items` 提供图标（横条 = `☰ 列表 + 被收起的便笺（颜色圆点）+ ＋ 新建`，图标数须与 `count` 一致），`launcher:state` 决定显示小球还是横条；小球 `.ball` 常态 `opacity:.7`、`:hover` 为 `1`；根元素 `pointerdown` 触发纵向拖动。`body.launcher-page` 透明、无背景/圆角/投影。
- **收起动画**：点 ⇲ 时 `main.js` 用窗口 bounds 与 `getAnchor()` 算出**小球锚点在窗口内的百分比 origin**，通过 `window:dock-shrink` 发给渲染层；渲染层写入 `body.style.transformOrigin` 并加 `.shrinking`（`transform: scale(.06)` + `opacity:0`，见 `base.css`），于是窗口**朝小球所在点**收缩；`main.js` 延迟 `SHRINK_MS`(300ms) 再 `win.hide()`；重新显示前发 `window:reset`，渲染层瞬时清除 class 与 origin（避免再次出现时从 0.06 放大）。

## 主题（暗夜模式）

CSS 变量四主题：`:root` 浅色（米色，默认）、`[data-theme="white"]` 白底、`[data-theme="dark"]` 暗色，两页共用同一套变量名。
`theme` 偏好存 `settings.json`，取值 `system` / `white` / `light` / `dark`，主进程 `nativeTheme.themeSource` 同步，多窗口通过 `theme:changed` 广播。
`system` 模式下亮色系统映射为 `light`、暗色系统映射为 `dark`；手动三色调（白/浅/暗）互不重叠。

## 约定与注意事项

- **安全红线**：`contextIsolation: true`、`nodeIntegration: false` 不可改。渲染层只能通过 `window.api` 通信。
- **CSP**：两页均设置 `default-src 'self'`，不要引入内联脚本或外域资源。
- **列表页渲染用户数据必须转义**（`index.js` 的 `escapeHtml`），防止便笺标题/预览注入 HTML。
- 便笺窗口关闭只关窗口不删数据；删除走列表页的删除按钮（或 `note:delete`）。
- 无边框窗口的拖拽区域靠 CSS `-webkit-app-region: drag`，交互元素需 `-webkit-app-region: no-drag`。
- **便笺 UI 风格**：克制的文档式排版 —— 标题 `font-weight:600` + `letter-spacing:-.01em`；正文 14px / `line-height:1.75`；分区用 1px `--line-strong` 分隔；复选框为**自定义方框**（非 emoji）；工具栏按「文字 / 标题 / 列表 / 行内 / 插入」分组并用竖线分隔。新增控件请沿用这套字号节奏与 `Icon.vue` 图标，勿引入异质字号或多套图标风格。

## 打包与代码签名

- `npm run dist` = `npm run build` + `scripts/sign-and-package.ps1`（设置 `CSC_LINK` / `CSC_KEY_PASSWORD` 后调 `electron-builder --win`）。产物 `dist/轻笺-Setup-${version}.exe` 与 `dist/win-unpacked/轻笺.exe`。
- **每次代码修复改完后，都要自动走完整发版流程（不必等确认）**：改 `package.json` 版本号 → `npm run dist` 打包签名 → 删 `dist/` 里旧版本产物 → `git commit` + `git push` → `gh release create vX.Y.Z` 上传安装包 → **把新安装包静默装到本机**（先关掉正在运行的轻笺，再 `Qingjian-Setup-X.Y.Z.exe /S`，装到 `%LOCALAPPDATA%\Programs\qingjian`），确保本机跑的始终是最新版。即「改完即打包发布并更新本机」。
- 证书：优先外部 `CSC_LINK`；否则用 `certs/qingjian-sign.pfx`（缺则调 `scripts/make-dev-cert.ps1` 生成自签名证书）。**正式发布换成 CA 的 .pfx 即可，代码不用改。**
- electron-builder 26 的签名选项在 **`win.signtoolOptions`**（`signingHashAlgorithms` / `rfc3161TimeStampServer`），**不要写在 `win` 顶层**（会 schema 校验失败：`configuration.win should be one of these: null`）。
- 打包只含 `build.files` 白名单；**任何用户数据都不进安装包**（全在 `%APPDATA%\轻笺\`）。可 `npx @electron/asar list dist/win-unpacked/resources/app.asar` 复查。
- **体积优化**：`electronLanguages: ["zh-CN","en-US"]` 只留两套界面语言（Electron 默认带 55 个 locale，占 ~46MB）；`compression: "maximum"` 让安装包更小；`afterPack`（`scripts/after-pack.js`）删掉仅 WebGPU/D3D12 用的 `dxcompiler.dll`/`dxil.dll`（~26MB）。安装后 347→**276MB**、安装包 95→**80MB**。再往下就是 Electron 本身的底（`轻笺.exe` 215MB），想要 10MB 级请换 Tauri / 原生。
- PowerShell 脚本须存为 **UTF-8 带 BOM**，否则 PowerShell 5.1 按 ANSI 解码、中文输出乱码。

## 已知问题 / 踩坑记录

1. **Electron 二进制 postinstall 下载失败**：`.npmrc` 已配置 `electron_mirror=https://npmmirror.com/mirrors/electron/`。若 `node_modules/electron/dist/electron.exe` 缺失或 `path.txt` 缺失，需手动下载镜像 zip 解压到 `dist/` 并写入 `path.txt`（内容为 `electron.exe`）。
2. **行尾判断/行内转换曾失效**：`collapse(false)` 后 selection 停在元素边界，导致 `convertInline` 被跳过（已用 `textNodeAtCaret()` 解决）；且 `caretAtEndOf` 用 `compareBoundaryPoints` 比较会因「(文本节点末尾) vs (元素边界)」不相等而误判为不在行尾。现用「块开头到光标文本长度 >= 块总文本长度」判断行尾，勿回退为 Range 边界比较。
3. **空编辑器首次输入**：初始化时若便笺为空直接写入 `<p><br></p>`，且 `input` 事件里先 `normalize()` 兜底，保证块结构统一；粘贴/拖放均被拦截并转为纯文本段落。不要依赖 `beforeinput` 插块（对 IME 有干扰）。
4. **透明窗口 resize**：Windows 上 `transparent: true` 窗口系统 resize 失效，需自绘 `.rz` 手柄（`pointer capture` + `setBounds`）实现调整大小。
5. **单例锁被打包版残留进程占用**：打包后进程名是「轻笺」而非「electron」。排查启动失败时须同时清理 `Get-Process electron` 和 `Get-Process 轻笺`；`%APPDATA%\轻笺\lockfile` 被占用会导致 `requestSingleInstanceLock()` 返回 false。
6. **E2E 模块须隔离存储**：`tests/e2e-runner.js` 中每个模块用独立临时目录（`initStore` 换新 store），否则前一模块残留的便笺会污染后续模块的计数断言。
7. **列表窗口无法拖动**：原列表页头部用 `position:absolute`（配合 `.grid` 的 `padding-top` 占位），`-webkit-app-region: drag` 命中不稳。已重构为普通 flex 纵向布局（header / search / grid / footer 依次排列），拖动与便笺标题栏一致，勿再改回绝对定位。
8. **启动器小球露出的是半圆**：`ballBounds` 把窗口中心压在屏幕边缘上（右侧 `x = wa.right - BALL_R`），窗口一半在屏外，靠屏幕裁剪露出半个球；横条则整条贴齐屏幕内边缘并在贴边侧改直角（`border-radius` 由 `frontend/launcher/App.vue` 按 `data-edge` 控制）。
9. **列表窗口标题栏按钮点了没反应**：`@click="window.api.minimize()"` 中 `window` 不在 Vue 模板作用域（模板只暴露组件作用域 + 白名单全局），编译成 `_ctx.window` → `undefined`。标题栏等交互一律调用 `<script setup>` 里定义的方法（如 `minimizeWin()`），**不要在模板里用 `window.*`**。
10. **小球窗口不能小于 ~32×38**：Windows 对无边框窗口有最小尺寸（实测 `setBounds(30,30)` 会被拉成 `32×38`）。故 `BALL_R = 20`（窗口 40×40）、小球元素 32×32；`movable:false` 不影响程序化 `setBounds`（拖动靠它实现）。
11. **nativeTheme 只接受 system/light/dark**：自定义「白底 white」不能直接赋给 `nativeTheme.themeSource`，否则抛 `conversion failure from white`。`main.js` 统一把 `white → light`（`settings:set` 与启动初始化两处都要映射）。
12. **标题栏图标统一**：`frontend/src/components/Icon.vue` 提供一整套同规格线性 SVG（Lucide 风格 / 24 视窗 / `stroke-width:1.5`）；便笺 `TitleBar.vue`、列表页头与工具栏插入按钮只用它，**不要再混用 emoji/ASCII 字形**。
13. **分区边界令牌**：`base.css` 里 `--chrome`（同色系加深底色，用于标题栏/工具栏）与 `--line-strong`（同色系加深描边，用于分区线）。便笺的「标题栏 / 工具栏 / 正文」据此分三层，勿用纯黑/纯白硬编码边界。
14. **透明无边框窗口不要给 body 加 box-shadow**：窗口可用区就等于 body，向外的投影会被窗口矩形**裁掉**，在四角留下一圈生硬的直角边（列表/便笺窗口曾是重灾区）。若要给窗口内的小元素阴影（如启动器小球），阴影必须完全落在窗口内的透明留白里，否则同样会被裁成方块：小球取 `BALL_R=16`（元素 32px）+ `MARGIN=12` 透明留白 → 收起窗口 `WIN_R*2=56×56`，投影 `0 3px 8px`（11px ≤ 12px 留白）刚好放得下。
