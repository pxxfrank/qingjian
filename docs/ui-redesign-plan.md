# 轻笺 UI 重构方案（Vue 3 + Naive UI）

> 版本：v1.0 · 2026-08-14
> 状态：待确认执行（回复"开始"后按第五节步骤执行）

## 一、总体思路

**不动核心，只换外壳。** WYSIWYG 引擎（note.js 的块级/行内渐进转换逻辑）是纯 DOM 操作，与框架无关，原样保留；重构的是两个窗口的 UI 外壳。主进程 `main.js`、`preload.js`、`store.js`、IPC 契约、数据存储格式**零改动**，`test-smoke.js` 冒烟测试和 `tests/` 目录全部保留可用。

## 二、目标架构

```
07-windows便笺/
├── main.js / preload.js / store.js     ← 不动
├── test-smoke.js / tests/              ← 不动（note.js 引擎逻辑不变）
├── frontend/                           ← 新增，Vite 工程
│   ├── vite.config.js                  ← 多页构建：list.html + note.html
│   ├── list/                           ← 列表窗口入口
│   │   ├── index.html
│   │   ├── main.js                     ← createApp(App).use(NaiveUI)
│   │   └── App.vue
│   ├── note/                           ← 便笺窗口入口
│   │   ├── index.html
│   │   ├── main.js
│   │   └── App.vue
│   └── src/
│       ├── tokens.js                   ← 设计令牌（注入 Naive UI themeOverrides）
│       ├── theme.js                    ← 三主题（清新/白底/暗色）切换 + body[data-theme]
│       ├── components/
│       │   ├── TitleBar.vue            ← 通用标题栏（拖拽区 + 窗口控制按钮）
│       │   ├── NoteCard.vue            ← 列表卡片（色条/标题/预览/时间/删除二次确认）
│       │   ├── SearchPill.vue          ← 胶囊搜索框
│       │   ├── EditorToolbar.vue       ← 格式工具栏
│       │   └── ColorPicker.vue         ← 六色选择浮层
│       ├── editor/                     ← 从 note.js 平移的引擎（不改逻辑）
│       │   └── engine.js               ← convertBlock / convertInline / handleEnter...
│       └── styles/
│           └── base.css                ← 圆角窗口、滚动条、resize 手柄等全局样式
└── renderer/                           ← 构建输出目标（或改为 dist/，main.js 加载路径相应配置）
```

**关键决策：Vite 多页应用（MPA）**，两个窗口各自独立入口，构建后 `main.js` 加载路径从 `renderer/index.html` 改为构建产物路径即可，其余不动。

## 三、视觉设计规范（清新薄荷 · 玻璃拟态）

延续已定的设计方向，固化为令牌：

| 令牌 | 亮色 | 暗色 |
|---|---|---|
| 主色 accent | `#2fbf8f` | `#4fd0a3` |
| 主色深阶 | `#25a67b` | `#6adbb4` |
| 背景 | `#f2f6f3` | `#161d1a` |
| 玻璃层 | `rgba(255,255,255,.72)` | `rgba(30,38,34,.68)` |
| 文字 / 次要 | `#2d3833` / `#7b8781` | `#e4ece8` / `#8b988f` |
| 危险色 | `#e5564b` | `#f07a6f` |

- **圆角体系**：控件 9px / 卡片 13px / 窗口 16px（含 html 透明背景图防背景传播修复，保证四角全圆）
- **阴影三级**：卡片静态 → 悬停浮起 → 窗口投影
- **毛玻璃**：列表页头部悬浮玻璃（卡片滚动穿过时模糊）、颜色选择器磨砂浮层，`backdrop-filter: blur(22px) saturate(1.6)`
- **便笺六色**：低饱和马卡龙纸面（黄 `#fff8e2`、绿 `#edf7ef`、蓝 `#ecf4fc`、粉 `#fdf0f4`、紫 `#f5f0fc`、白），暗色对应深色系
- **动效**：统一 `160ms cubic-bezier(.2,.8,.2,1)`，Naive UI 组件过渡与之对齐

## 四、组件映射（Naive UI 用法）

| 现有元素 | 重构后 |
|---|---|
| 主题/新建/最小化/关闭按钮 | `NButton` quaternary + 自定义 hover 令牌 |
| 搜索框 | `NInput` round，聚焦绿色光环 |
| 便笺卡片 | 自绘 `NoteCard.vue`（Naive UI 无对应组件，用令牌手写） |
| 删除二次确认 | `NPopconfirm` 或保留现有"点击变确认"交互 |
| 格式工具栏 | `NButton` quaternary 小尺寸组 + 分隔线 |
| 颜色选择器 | `NPopover` + 六色圆形 swatch |
| 编辑器 | **原生 contenteditable，不组件化** |
| 空状态 | `NEmpty` + 🍃 自定义插画 |

## 五、执行步骤（确认后按此顺序）

1. 初始化 `frontend/` Vite + Vue3 工程，配置 MPA 双入口与构建输出路径
2. 写 `tokens.js` + `theme.js`，把三主题接入 Naive UI `themeOverrides` 和 `body[data-theme]`
3. 重构列表窗口 `App.vue`（玻璃头、卡片列表、搜索过滤、删除确认）—— 现有 `index.js` 的 IPC 调用逻辑平移
4. 重构便笺窗口 `App.vue`（标题栏、工具栏、颜色选择器），挂载原生 editor
5. 平移 `note.js` 引擎为 `editor/engine.js`（不改逻辑），接入编辑器 DOM
6. 改 `main.js` 两处 `loadFile` 路径指向构建产物
7. 跑 `test-smoke.js` + `tests/` 全部测试 + 截图脚本目检两窗口三主题六配色
8. 更新 `claude.md` 架构说明（零构建 → Vite 构建）和 `README.md` 命令

## 六、风险与说明

- **构建链**：新增 `npm run build` / `npm run dev` 步骤；`npm start` 保持不变（加载构建产物）
- **体积**：node_modules 显著变大，但打包产物增量可控（Naive UI 按需引入，约 300KB gzip 内）
- **编辑器兼容性**：引擎不经过 Vue 响应式系统，直接操作 DOM，无冲突
- **冒烟测试**：`test-smoke.js` 加载的是 HTML 文件路径，届时指向构建后的 `note.html` 即可，断言逻辑不受影响
- 旧的 `renderer/*.js`（index.js / note.js）在重构完成后删除，CSS 被组件样式取代
