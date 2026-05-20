# 卡片编辑态溢出修复与工具栏 Portal 化设计

## 问题

1. 编辑态下文本内容超出卡片边界，视觉上不好看
2. BlockNote 内置的划词工具栏（FormattingToolbar）和斜杠菜单（SlashMenu）渲染在组件树内部，被祖先容器的 `overflow: hidden` 裁切

## 方案

自定义 FormattingToolbar 和 SlashMenu 组件，通过 `createPortal` 渲染到 `document.body`，同时卡片编辑态改为 `overflow: auto` 实现内部滚动。

## 修改清单

### 1. CardContent.tsx — 卡片编辑态溢出修复

**当前**：编辑态 `overflow: 'visible'`，文本可超出卡片边界

**改为**：
- 编辑态外层 `overflow: 'auto'`，文本在卡片内滚动
- 移除内层 `overflow: 'visible'` 的包装 div
- 非编辑态保持 `overflow: 'hidden'` + 预览 HTML 不变

### 2. CardFormattingToolbar.tsx — 自定义划词工具栏

新建 `src/components/editor/CardFormattingToolbar.tsx`：

- 使用 BlockNote 的 `FormattingToolbar` 组件（包含 `FormatBoldButton`、`FormatItalicButton` 等）
- 通过 `createPortal` 渲染到 `document.body`
- 使用 `position: fixed` + `getBoundingClientRect()` 计算位置
- 监听编辑器选区变化控制显示/隐藏
- `getBoundingClientRect()` 返回视口坐标，天然包含 React Flow 缩放变换
- z-index: 9999，与 ImageToolbar 一致

### 3. CardSlashMenu.tsx — 自定义斜杠菜单

新建 `src/components/editor/CardSlashMenu.tsx`：

- 使用 BlockNote 的 `SuggestionMenu` 组件渲染菜单项
- 通过 `createPortal` 渲染到 `document.body`
- 使用 `position: fixed` + `getBoundingClientRect()` 计算位置
- 监听 slash 触发和查询变化
- z-index: 9999

### 4. BlockNoteEditor.tsx — 集成自定义工具栏

- `BlockNoteView` 的 `formattingToolbar` 和 `slashMenu` 设为 `false`，禁用默认工具栏
- 在 `BlockNoteView` 外部渲染 `CardFormattingToolbar` 和 `CardSlashMenu`
- 传入 `editor` 实例和 `containerRef`

### 5. CSS 调整

- 卡片编辑态滚动条样式与全局隐藏滚动条一致
- Portal 容器 z-index 层级管理

## 技术细节

### 位置计算

`getBoundingClientRect()` 返回的坐标是相对于视口的，已经包含了：
- React Flow 的缩放（zoom）
- React Flow 的平移（pan）
- 卡片在画布上的位置

因此直接使用这些坐标设置 `position: fixed` 的 `top`/`left` 即可，无需额外变换。

### 显示/隐藏逻辑

**FormattingToolbar**：
- 编辑器有非空选区时显示
- 选区折叠或编辑器失焦时隐藏
- 通过 BlockNote editor 的 `onEditorChange` 回调监听选区变化

**SlashMenu**：
- 用户输入 `/` 触发时显示
- 选择菜单项或按 Esc 时隐藏
- 通过 BlockNote 的 SuggestionMenu controller 机制触发

### 与 ImageToolbar 的一致性

自定义工具栏的模式与现有 ImageToolbar 保持一致：
- Portal 到 `document.body`
- `position: fixed` 定位
- `getBoundingClientRect()` 计算坐标
- z-index: 9999

## 不做的事

- 不修改 React Flow 的 viewport overflow（避免副作用）
- 不修改非编辑态的卡片行为
- 不修改 ImageToolbar 的现有实现
- 不添加 BlockNote 没有的工具栏功能
