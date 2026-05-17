# 代码可维护性重构计划

## 目标

渐进式拆分大文件、消除代码重复、解耦业务逻辑与 UI，每步可独立验证，不阻塞日常开发。

## 问题总览

| 类别 | 问题 | 影响范围 |
|------|------|----------|
| 大文件 | 5 个文件超 300 行，职责混杂 | BlockNoteEditor(463)、LeftPanel(429)、ReactFlowCanvas(405)、CardActionBar(385)、ImageToolbar(373) |
| 代码重复 | `isDarkMode` 选择器 20+ 处重复 | 全 UI 层 |
| 代码重复 | `store.getState()` 命令式调用 30+ 处 | api.ts、LeftPanel、CardNode 等 |
| 逻辑散落 | 画板 CRUD 在 LeftPanel、useWorkspaceLifecycle、useWorkspaceDataLoader 中重复 | 3 个文件 |
| 组件膨胀 | SharedUI.tsx 9 个组件挤 209 行 | 全 UI 层 |
| 组件膨胀 | CardActionBar.tsx 含 3 个内联子组件 | CardActionBar、MoreActionsMenu、BoardSubmenu、MenuItem |

---

## Phase 1：提取共享 hook（风险最低，收益最高）

### 1.1 创建 `useIsDarkMode()` hook

**文件**: `src/hooks/useIsDarkMode.ts`

```ts
import { useLibraryStore } from '../utils/libraryStore'
export function useIsDarkMode() {
  return useLibraryStore(s => s.isDarkMode)
}
```

**替换**: 全部 20+ 处 `useLibraryStore(s => s.isDarkMode)` → `useIsDarkMode()`

**涉及文件**: SharedUI.tsx(8处)、CardActionBar.tsx(3处)、LeftPanel.tsx、RightPanel.tsx、RightPanelCollapsed.tsx、LeftPanelCollapsed.tsx、CardEditDialog.tsx、CardLibraryView.tsx、BoardLibraryView.tsx、TrashBinPanel.tsx、SettingsDialog.tsx、Toolbar.tsx、WorkspacePicker.tsx、TitleBar.tsx、CardNode.tsx、ReactFlowCanvas.tsx

### 1.2 创建 `usePanelSurface()` hook

**文件**: `src/hooks/usePanelSurface.ts`

```ts
import { useIsDarkMode } from './useIsDarkMode'
import { getPanelSurface } from '../theme'
export function usePanelSurface() {
  const isDarkMode = useIsDarkMode()
  return getPanelSurface(isDarkMode)
}
```

**替换**: 所有 `const isDarkMode = ...; const surface = getPanelSurface(isDarkMode)` 模式（10+ 处）

**涉及文件**: SharedUI.tsx(6处)、LeftPanel.tsx、RightPanel.tsx、CardActionBar.tsx、Toolbar.tsx 等

### 验证

- `pnpm dev` 启动无报错
- 全局搜索确认无残留的 `useLibraryStore(s => s.isDarkMode)` 直接调用
- 主题切换功能正常

---

## Phase 2：拆分 CardActionBar.tsx（385 → 4 个文件）

### 2.1 拆分目标

| 新文件 | 内容 | 预估行数 |
|--------|------|----------|
| `card/CardActionBar.tsx` | 主组件 + ActionBarButton | ~160 |
| `card/MoreActionsMenu.tsx` | MoreActionsMenu + 颜色选择器 | ~100 |
| `card/BoardSubmenu.tsx` | BoardSubmenu | ~55 |
| `card/MenuItem.tsx` | 通用 MenuItem | ~35 |

### 2.2 拆分步骤

1. **提取 MenuItem** → `card/MenuItem.tsx`
   - 移出 `MenuItem` 组件和 props 类型
   - CardActionBar 和 MoreActionsMenu 改为 import

2. **提取 BoardSubmenu** → `card/BoardSubmenu.tsx`
   - 移出 `BoardSubmenu` 组件
   - 引用 MenuItem 从同目录导入

3. **提取 MoreActionsMenu** → `card/MoreActionsMenu.tsx`
   - 移出 `MoreActionsMenu` 组件
   - 引用 MenuItem、BoardSubmenu
   - `extractTitle` 工具函数也移入此文件（仅此处使用）

4. **精简 CardActionBar.tsx**
   - 保留 `CardActionBar` 主组件 + `ActionBarButton`
   - import MoreActionsMenu

### 验证

- 画布上卡片 hover 时 action bar 正常显示
- 折叠/展开、连接、打开右侧面板功能正常
- 更多菜单：颜色选择、移动到画板、移出白板功能正常
- 右键菜单正常

---

## Phase 3：拆分 LeftPanel.tsx（429 → 4 个文件）

### 3.1 拆分目标

| 新文件 | 内容 | 预估行数 |
|--------|------|----------|
| `ui/LeftPanel.tsx` | 主组件布局壳 | ~80 |
| `ui/BoardList.tsx` | 画板列表 + 画板项 + 内联编辑 | ~160 |
| `ui/BoardContextMenu.tsx` | 右键菜单（重命名/删除/复制/打开资源管理器） | ~70 |
| `hooks/useBoardActions.ts` | 画板 CRUD 逻辑（create/rename/delete/duplicate） | ~80 |

### 3.2 拆分步骤

1. **提取 useBoardActions hook** → `hooks/useBoardActions.ts`
   - 从 LeftPanel 中提取 `handleCreateBoard`、`handleRenameBoard`、`handleDeleteBoard`、`handleDuplicateBoard`
   - 这些函数内部通过 `useBoardStore.getState()` 操作 store，提取后改为 hook 内部使用 store hook
   - `ViewModeButton` 组件也移入此文件或保留在 LeftPanel（它很小，8 行）

2. **提取 BoardContextMenu** → `ui/BoardContextMenu.tsx`
   - 移出 `ContextMenu` 组件和 `ContextMenuItem` 类型
   - 通用性足够，其他面板也可能复用

3. **提取 BoardList** → `ui/BoardList.tsx`
   - 移出画板列表渲染、画板项点击/双击/右键、内联编辑输入框
   - 新建画板输入框也在此组件内

4. **精简 LeftPanel.tsx**
   - 保留布局壳：头部（工作区名 + 折叠按钮）、ViewModeButton 切换、BoardList、回收站按钮
   - import BoardList、BoardContextMenu

### 验证

- 左侧面板正常显示画板列表
- 点击切换画板、双击重命名、右键菜单（重命名/删除/复制/打开资源管理器）功能正常
- 新建画板功能正常
- 画板库/卡片库视图切换正常
- 折叠/展开面板正常

---

## Phase 4：拆分 ReactFlowCanvas.tsx（405 → 主文件 + 3 个 hook）

### 4.1 拆分目标

| 新文件 | 内容 | 预估行数 |
|--------|------|----------|
| `canvas/ReactFlowCanvas.tsx` | 主组件 + ReactFlow 配置 | ~120 |
| `hooks/useCanvasZoom.ts` | 缩放事件监听（zoom-in/out/fit-view + d3-zoom 平滑补丁） | ~60 |
| `hooks/useCanvasConnection.ts` | 连接完成 + 重连逻辑（onConnect/onReconnect/onReconnectEnd） | ~60 |
| `hooks/useCanvasDrag.ts` | 节点拖拽时边 handle 更新（onNodeDrag/onNodeDragStop） | ~50 |

### 4.2 拆分步骤

1. **提取 useCanvasZoom** → `hooks/useCanvasZoom.ts`
   - 移出 `hepta-zoom-in`、`hepta-zoom-out`、`hepta-fit-view` 事件监听
   - 移出 d3-zoom `smoothWheel` 补丁逻辑
   - 接收 `reactFlowInstance` ref 和 `canvasRef`

2. **提取 useCanvasConnection** → `hooks/useCanvasConnection.ts`
   - 移出 `onConnect`、`onReconnect`、`onReconnectEnd`
   - 移出 `connectionMediator.onComplete` 订阅
   - 接收 `setEdges`、`reconnectSuccessRef`

3. **提取 useCanvasDrag** → `hooks/useCanvasDrag.ts`
   - 移出 `onNodeDrag`、`onNodeDragStop`
   - 接收 `reactFlowInstance`、`setEdges`、`nodesRef`

4. **精简 ReactFlowCanvas.tsx**
   - 保留：状态声明、useWorkspaceLifecycle/useBoardSync/useSectionSync/useCanvasPaste/useDropHandler 调用、onInit/onMove/onPaneClick/onNodeClick/onMouseMove、JSX 渲染
   - import 三个新 hook

### 验证

- 画布正常渲染节点和边
- 滚轮缩放平滑
- 快捷键缩放（Ctrl++/Ctrl+-/Ctrl+0）正常
- 拖拽节点时连接线跟随
- 创建连接、重连连接、删除连接正常
- 拖拽外部文件到画布创建卡片正常

---

## Phase 5：拆分 BlockNoteEditor.tsx（463 → 2 个文件）

### 5.1 拆分目标

| 新文件 | 内容 | 预估行数 |
|--------|------|----------|
| `editor/BlockNoteEditor.tsx` | 编辑器组件 + forwardRef | ~420 |
| `utils/richTextUtils.ts` | `extractText`、`summarizeRichTextPreview`、`parseContentToBlocks`、`toComparableJson`、`fileToDataUrl`、`isImageFile`、`isReadableImageUrl`、`readClipboardImageFiles` | ~80 |

### 5.2 拆分步骤

1. **提取 richTextUtils** → `utils/richTextUtils.ts`
   - 移出所有纯工具函数（无 React 依赖）
   - `SAVE_DEBOUNCE_MS` 常量也移入

2. **精简 BlockNoteEditor.tsx**
   - import 工具函数
   - 组件逻辑不变

### 验证

- 编辑器正常渲染和编辑
- 图片粘贴/拖入正常
- 预览文本摘要正常
- 右侧面板编辑器同步正常

---

## Phase 6：拆分 SharedUI.tsx（209 → 5 个文件）

### 6.1 拆分目标

| 新文件 | 内容 |
|--------|------|
| `ui/PanelHeader.tsx` | PanelHeader |
| `ui/PanelButtons.tsx` | SideTabButton、PanelButton |
| `ui/PanelLayout.tsx` | PanelSeparator、PanelSection、ExpandButton、CollapseButton |
| `ui/EmptyState.tsx` | EmptyState |
| `ui/SearchInput.tsx` | SearchInput |

### 6.2 拆分步骤

1. 每个组件独立文件，各自 import `usePanelSurface`
2. `SharedUI.tsx` 改为 re-export barrel 文件，保持现有 import 路径兼容

```ts
// SharedUI.tsx (barrel)
export { PanelHeader } from './PanelHeader'
export { SideTabButton, PanelButton } from './PanelButtons'
export { PanelSeparator, PanelSection, ExpandButton, CollapseButton } from './PanelLayout'
export { EmptyState } from './EmptyState'
export { SearchInput } from './SearchInput'
```

### 验证

- 所有面板 UI 正常显示
- 主题切换正常
- 折叠/展开按钮正常

---

## Phase 7：附带性能修复（在拆分过程中顺手修复）

### 7.1 CardNode store 选择器优化

**问题**: `useCardStore((s) => s.cards[data.cardId])` 在任何卡片更新时都会重渲染所有 CardNode

**修复**: 在 `cardStore.ts` 中添加 `useCard` 选择器 hook

```ts
// cardStore.ts
export function useCard(cardId: string) {
  return useCardStore(
    useCallback((s) => s.cards[cardId], [cardId])
  )
}
```

**替换**: CardNode.tsx 中 `const card = useCardStore((s) => s.cards[data.cardId])` → `const card = useCard(data.cardId)`

### 7.2 ConnectionEdge 添加 React.memo

**文件**: `canvas/ConnectionEdge.tsx`

```ts
export const ConnectionEdge = React.memo(function ConnectionEdge({...})
```

### 7.3 CardHandles 提取常量样式

**文件**: `card/CardHandles.tsx`

将 8 个 Handle 的 inline `style={{}}` 提取为模块级常量对象，避免每次渲染创建新对象。

### 验证

- 画布上 10+ 卡片时拖拽/编辑无明显卡顿
- 连接线在拖拽/缩放时流畅渲染

---

## 执行顺序与依赖

```
Phase 1 (共享 hook) ──→ Phase 2 (CardActionBar) ──→ Phase 6 (SharedUI)
                    ──→ Phase 3 (LeftPanel)
                    ──→ Phase 4 (ReactFlowCanvas)
                    ──→ Phase 5 (BlockNoteEditor)
Phase 7 (性能修复) 可在任意 Phase 间穿插执行
```

- Phase 1 是所有后续 Phase 的前置依赖
- Phase 2-5 互相独立，可任意顺序执行
- Phase 6 依赖 Phase 1（使用 usePanelSurface）
- Phase 7 中的 7.1 可在 Phase 1 完成后立即执行

## 风险控制

- 每个 Phase 完成后运行 `pnpm dev` 验证无报错
- 每个 Phase 只改一个模块，不影响其他模块
- SharedUI.tsx 保留 barrel re-export，现有 import 路径无需修改
- 不改变任何组件的外部 API（props、export 名称）