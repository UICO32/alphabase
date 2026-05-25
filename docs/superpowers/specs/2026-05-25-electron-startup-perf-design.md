# Electron 启动性能优化设计

## 问题

双击 exe 到窗口可见耗时过长，窗口出现后白屏 → splash → 内容的过渡粗糙。

## 根因

1. **openDevTools 无条件调用** — 生产包也开 DevTools，浪费 1-2s
2. **无 splash 窗口** — 用户看到空白窗口 → 白屏，直到 JS 加载完
3. **embedding.init 阻塞画板渲染** — ONNX 模型加载在 hepta-data-ready 关键路径上
4. **节点无渐进加载** — 数据就绪后一次性渲染所有节点，无过渡
5. **ASAR 包含原生模块** — sharp 等原生模块未配 asarUnpack

## 方案：5 项措施

### 1. 移除生产 openDevTools

`electron/main.ts` 中 `openDevTools()` 改为仅 `!app.isPackaged` 时调用。

### 2. Electron Splash 窗口

两阶段窗口创建：
- 阶段 1：立刻创建轻量 splash 窗口（frameless，居中，内联 HTML/CSS 动画）
- 阶段 2：主窗口 `show: false` 后台加载，`did-finish-load` 后关闭 splash、show 主窗口

Splash 窗口：300x300，居中，透明背景，含品牌色旋转动画 + "Heptabase Canvas" 文字。

### 3. Embedding 延迟初始化

`useWorkspaceLifecycle.ts` 中 `embedding.init()` 从 hepta-data-ready 关键路径移出：
- 改为 `requestIdleCallback` 或 3s 延迟触发
- 搜索功能在未就绪时显示提示
- 不阻塞画板渲染和交互

### 4. 节点骨架动画

CardNode 增加 loading 状态：
- 数据未就绪时显示骨架占位（灰色矩形 + shimmer 动画）
- 数据就绪后 fade-in 替换为真实内容
- 不影响已有 previewHTML 优化

### 5. ASAR 优化

`package.json` build.asarUnpack 增加 `sharp`，减少 ASAR 体积和 I/O。

## 预期效果

- 窗口出现提速 2-3s（splash 替代白屏 + 移除 openDevTools）
- 画板可交互提速 1-2s（embedding 不再阻塞）
- 体感流畅度大幅提升（骨架动画 + 渐进加载）
