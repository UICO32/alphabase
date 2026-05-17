# 左右侧面板核心功能总结

> 本文档总结老项目中左右侧面板的核心功能代码，供新项目直接复用。重点关注状态机管理、工作区管理和回收站逻辑。

---

## 一、状态机总览

面板状态由 3 个 Zustand Store 协同管理：

```
┌─────────────────────────────────────────────────────────────┐
│  useLibraryStore  —  视图模式 + 侧栏折叠状态                  │
│  useWorkspaceStore —  工作区 UI 状态（名称、就绪、错误）       │
│  useBoardStore    —  画板列表 + 当前活动画板                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 useLibraryStore（视图与布局状态）

```typescript
// src/utils/libraryStore.ts
export type ViewMode = 'board' | 'cards' | 'boardLibrary'

interface LibraryStore {
  viewMode: ViewMode              // 当前视图：画布 / 卡片库 / 画板库
  editingCardId: string | null    // 正在编辑的卡片 ID（右侧面板编辑态）
  isDarkMode: boolean             // 暗色模式（从 tldraw 同步，新项目改为系统/theme）
  cardLibrarySubTab: 'cards' | 'properties'  // 卡片库子标签
  leftPanelCollapsed: boolean     // 左侧面栏折叠
  rightPanelCollapsed: boolean    // 右侧面栏折叠

  setViewMode: (mode: ViewMode) => void
  openCardEditor: (cardId: string) => void    // 打开卡片编辑器
  closeCardEditor: () => void                  // 关闭卡片编辑器
  syncDarkMode: (v: boolean) => void           // 同步暗色模式
  setCardLibrarySubTab: (tab: 'cards' | 'properties') => void
  setLeftPanelCollapsed: (collapsed: boolean) => void
  setRightPanelCollapsed: (collapsed: boolean) => void
  toggleAllSidebars: () => void   // Tab 键：同时折叠/展开两侧
}
```

**关键设计**：
- `viewMode` 是全局视图切换的核心状态，影响左右面板显示内容
- `leftPanelCollapsed` 和 `rightPanelCollapsed` 独立控制，但 `toggleAllSidebars()` 同时操作两者
- 折叠状态持久化到 localStorage（右侧面板宽度也持久化）

### 1.2 useWorkspaceStore（工作区 UI 状态）

```typescript
// src/utils/workspace/workspaceStore.ts
interface WorkspaceUiState {
  workspaceName: string | null     // 工作区名称
  isReady: boolean                 // 工作区是否就绪
  pendingWrites: number            // 待写入计数（保存指示器）
  error: string | null             // 错误信息
  showPicker: boolean              // 是否显示工作区选择器

  setWorkspaceName: (name: string | null) => void
  setIsReady: (ready: boolean) => void
  setPendingWrites: (n: number) => void
  setError: (msg: string | null) => void
  setShowPicker: (show: boolean) => void
}
```

**关键设计**：
- 纯 UI 状态，不涉及业务逻辑
- `pendingWrites` 用于显示"保存中..."指示器
- `showPicker` 控制启动时是否显示工作区选择器

### 1.3 useBoardStore（画板状态）

```typescript
// src/utils/boardStore.ts
interface BoardStore {
  boards: BoardMeta[]              // 画板列表
  activeBoardId: string | null     // 当前活动画板 ID

  setBoards: (boards: BoardMeta[]) => void
  addBoard: (meta: BoardMeta) => void
  removeBoard: (id: string) => void
  updateBoard: (id: string, patch: Partial<BoardMeta>) => void
  setActiveBoardId: (id: string | null) => void
}
```

**关键设计**：
- 画板列表从 `boards/_manifest.json` 加载
- `activeBoardId` 切换触发 `hepta-switch-board` 自定义事件
- 画板 CRUD 通过 `WorkspaceService` 操作文件系统

---

## 二、左侧面板（LeftPanel）

### 2.1 核心功能

| 功能 | 说明 |
|------|------|
| **工作区标题栏** | 显示工作区名称，点击展开设置浮层（切换/新建工作区、设置） |
| **视图切换按钮** | 画板库 / 卡片库 / 画布模式切换 |
| **画板列表** | 显示所有画板，支持点击切换、双击重命名、右键删除 |
| **新建画板** | 输入框内联创建 |
| **回收站入口** | 点击打开回收站弹窗 |
| **折叠/展开** | 收起为图标栏，展开显示完整内容 |

### 2.2 状态机交互

```
┌──────────────────────────────────────────────────────────────┐
│  LeftPanel 状态机                                             │
├──────────────────────────────────────────────────────────────┤
│  viewMode: 'board' | 'cards' | 'boardLibrary'                │
│  activeBoardId: string                                        │
│  isCollapsed: boolean                                         │
├──────────────────────────────────────────────────────────────┤
│  画板点击 → dispatchEvent('hepta-switch-board', {boardId})   │
│  视图切换 → setViewMode()                                     │
│  新建画板 → ws.createBoard() → addBoard()                     │
│  删除画板 → ws.deleteBoard() → removeBoard()                  │
│  重命名   → ws.renameBoard() → updateBoard()                  │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 画板切换事件流

```typescript
// LeftPanel 中画板点击处理
const handleBoardClick = useCallback((boardId: string) => {
  // 1. 如果已经是当前画板且在画布模式，跳过
  if (boardId === activeBoardId && viewMode === 'board') return

  // 2. 如果不在画布模式，先切回画布
  if (viewMode !== 'board') setViewMode('board')

  // 3. 触发自定义事件，由画布组件监听处理
  window.dispatchEvent(new CustomEvent('hepta-switch-board', { detail: { boardId } }))
}, [activeBoardId, viewMode])
```

**注意**：画板切换不由 LeftPanel 直接操作 store，而是通过事件委托给画布组件处理（因为画布需要先保存当前再加载新的）。

### 2.4 折叠状态同步

```typescript
// 本地状态与 Zustand store 双向同步
const [isCollapsedLocal, setIsCollapsedLocal] = useState(false)
const leftPanelCollapsed = useLibraryStore(s => s.leftPanelCollapsed)
const setLeftPanelCollapsed = useLibraryStore(s => s.setLeftPanelCollapsed)

const isCollapsedState = leftPanelCollapsed || isCollapsedLocal
const setIsCollapsed = (collapsed: boolean) => {
  setIsCollapsedLocal(collapsed)
  setLeftPanelCollapsed(collapsed)
}

// CSS 变量同步
useEffect(() => {
  document.documentElement.style.setProperty(
    '--left-sidebar-width',
    `${isCollapsedState ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px`
  )
}, [isCollapsedState])
```

### 2.5 关键代码段（可直接复用）

**画板列表渲染**：
```tsx
{boards.map((board) => (
  <div key={board.id} style={{ position: 'relative' }}>
    {editingBoardId === board.id ? (
      <input /* 重命名输入框 */
        ref={editInputRef}
        value={editingBoardName}
        onChange={(e) => setEditingBoardName(e.target.value)}
        onBlur={() => handleRenameBoard(board.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleRenameBoard(board.id)
          if (e.key === 'Escape') setEditingBoardId(null)
        }}
      />
    ) : (
      <BoardItem
        board={board}
        isActive={board.id === activeBoardId && viewMode === 'board'}
        onClick={() => handleBoardClick(board.id)}
        onDoubleClick={() => {
          setEditingBoardId(board.id)
          setEditingBoardName(board.name)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenuBoardId(contextMenuBoardId === board.id ? null : board.id)
        }}
      />
    )}
  </div>
))}
```

**删除画板逻辑**：
```typescript
const handleDeleteBoard = useCallback(async (boardId: string) => {
  // 1. 至少保留一个画板
  if (boards.length <= 1) { alert('至少保留一个画板'); return }

  // 2. 确认对话框
  if (!window.confirm(`确定删除画板「${board?.name || boardId}」？`)) return

  // 3. 删除文件 + 更新 store
  await ws.deleteBoard(boardId)
  removeBoard(boardId)

  // 4. 如果删除的是当前画板，切换到剩余的第一个
  if (activeBoardId === boardId) {
    const remaining = boards.filter(b => b.id !== boardId)
    const next = remaining[0]
    if (next) {
      window.dispatchEvent(new CustomEvent('hepta-switch-board', {
        detail: { boardId: next.id }
      }))
    }
  }
}, [boards, activeBoardId, removeBoard])
```

---

## 三、右侧面板（RightPanel）

### 3.1 核心功能

| 功能 | 说明 |
|------|------|
| **卡片库（Library）** | 所有卡片列表，支持搜索、拖拽到画布 |
| **卡片编辑器（Inspect）** | 选中卡片的详情编辑（颜色、变体、折叠等） |
| **宽度调整** | 拖拽左边缘调整面板宽度，持久化到 localStorage |
| **折叠/展开** | 点击标签按钮切换 |
| **Flomo 同步** | 第三方同步功能 |
| **导出备份** | 导出所有卡片为 JSON 备份 |

### 3.2 状态机交互

```
┌──────────────────────────────────────────────────────────────┐
│  RightPanel 状态机                                            │
├──────────────────────────────────────────────────────────────┤
│  activeTab: 'library' | 'editor'                              │
│  isOpen: boolean（由 rightPanelCollapsed + local 状态计算）    │
│  panelWidth: number（260~600，默认 360）                       │
│  libraryQuery: string（搜索关键词）                            │
│  inspectedCardId: string | null（当前查看的卡片）               │
├──────────────────────────────────────────────────────────────┤
│  选中画布卡片 → 自动切换到 editor tab，显示卡片详情            │
│  搜索卡片    → useDeferredValue 延迟过滤，避免输入卡顿         │
│  拖拽卡片    → setDraggedLibraryCardId() / clearDragged...()   │
│  创建卡片    → 在画布中心创建新卡片                            │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 卡片搜索与缓存

```typescript
// 文本缓存避免重复解析 BlockNote JSON
const cardTextCacheRef = useRef(new Map<string, CachedCardText>())

const allCards = useMemo(() => {
  const cards: LibraryCardItem[] = []
  for (const globalCard of Object.values(globalCards)) {
    const cached = cardTextCacheRef.current.get(globalCard.id)
    let text: CachedCardText
    if (cached && cached.content === globalCard.content) {
      text = cached  // 内容未变，使用缓存
    } else {
      text = summarizeCardContent(globalCard.content)  // 解析标题/预览/搜索文本
      cardTextCacheRef.current.set(globalCard.id, text)
    }
    cards.push({ id: globalCard.id, color: globalCard.color, ...text })
  }
  // LRU 清理：超过当前卡片数 + 20 时清理旧缓存
  if (cardTextCacheRef.current.size > cards.length + 20) {
    const activeIds = new Set(cards.map(c => c.id))
    for (const key of cardTextCacheRef.current.keys()) {
      if (!activeIds.has(key)) cardTextCacheRef.current.delete(key)
    }
  }
  cards.sort((a, b) => b.createdAt - a.createdAt)
  return cards
}, [globalCards])

// 搜索过滤（使用 deferredQuery 避免输入卡顿）
const filteredCards = useMemo(() => {
  const query = deferredQuery.trim().toLowerCase()
  if (!query) return allCards
  const tokens = query.split(/\s+/).filter(Boolean)
  return allCards.filter(card => tokens.every(token => card.searchableText.includes(token)))
}, [allCards, deferredQuery])
```

### 3.4 画布卡片选中联动

```typescript
// 监听画布选中状态，自动切换到编辑器 tab
useEffect(() => {
  if (selectedCardId && isOpen) {
    setInspectCardId(selectedCardId)
    setActiveTab('editor')
  }
}, [selectedCardId, isOpen])
```

**新项目适配**：从 `editor.getSelectedShapes()` 改为 React Flow 的 `useOnSelectionChange` 或 `selectedNodes`。

### 3.5 宽度调整实现

```typescript
const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
  e.preventDefault()
  isDraggingRef.current = true
  dragStartXRef.current = e.clientX
  dragStartWidthRef.current = panelWidth
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'

  const onMove = (ev: PointerEvent) => {
    if (!isDraggingRef.current) return
    const delta = dragStartXRef.current - ev.clientX
    const next = Math.max(PANEL_WIDTH_MIN, Math.min(PANEL_WIDTH_MAX, dragStartWidthRef.current + delta))
    setPanelWidth(next)
  }
  const onUp = () => {
    isDraggingRef.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}, [panelWidth])

// 持久化
useEffect(() => {
  localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(panelWidth))
}, [panelWidth])
```

---

## 四、回收站（TrashBinPanel + trashStore）

### 4.1 核心功能

| 功能 | 说明 |
|------|------|
| **回收站列表** | 显示所有已删除卡片，按删除时间倒序 |
| **恢复卡片** | 恢复到 cardStore，并在画布原位置重建形状 |
| **永久删除** | 从文件系统彻底删除 |
| **清空回收站** | 一键删除所有，带二次确认 |
| **过期提示** | 显示剩余天数，3 天后自动清理 |

### 4.2 状态机设计

```typescript
// src/utils/trashStore.ts
interface TrashStore {
  cards: Record<string, TrashCardData>   // 回收站卡片映射
  isLoaded: boolean                       // 是否已从工作区加载

  addToTrash: (data: TrashCardData) => Promise<void>
  restoreFromTrash: (id: string) => Promise<boolean>
  permanentDelete: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  loadFromWorkspace: () => Promise<void>
  cleanExpired: () => Promise<void>
}
```

**关键设计**：
- `trashStore` 依赖外部注入的 `_workspace`（通过 `setTrashStoreWorkspace()`）
- 所有操作都是异步的，涉及文件系统读写
- 恢复卡片时需要在画布上重建形状（新项目改为 `setNodes()`）

### 4.3 回收站数据流

```
删除卡片流程：
┌──────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐
│ 画布删除  │ → │ ws.moveCard │ → │ 写入 trash/ │ → │ 更新 store│
│          │    │ ToTrash()   │    │ <id>.trash  │    │ cards    │
└──────────┘    └─────────────┘    └─────────────┘    └──────────┘

恢复卡片流程：
┌──────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐
│ 点击恢复  │ → │ addCard()   │ → │ createShape │ → │ delete   │
│          │    │ (cardStore) │    │ (画布重建)   │    │ trashFile│
└──────────┘    └─────────────┘    └─────────────┘    └──────────┘
```

### 4.4 恢复卡片的画布重建（新项目需适配）

```typescript
// 老项目：使用 tldraw editor.createShape()
restoreFromTrash: async (id) => {
  const card = get().cards[id]
  if (!card) return false

  // 1. 恢复到 cardStore
  useCardStore.getState().addCard({
    id: card.id,
    content: card.content,
    color: card.color,
    variant: card.variant,
    createdAt: card.createdAt,
    enforceInitialHeading: true,
  })

  // 2. 在画布上重建形状（新项目改为 setNodes）
  const editor = (window as any).__tldraw_editor
  if (editor) {
    const shapeId = createShapeId()
    editor.createShape({
      id: shapeId,
      type: 'card',
      x: card.shapeX,
      y: card.shapeY,
      props: {
        w: card.shapeW || DEFAULT_CARD_WIDTH,
        h: card.shapeH || DEFAULT_CARD_HEIGHT,
        cardId: card.id,
      },
    })
    editor.select(shapeId)
  }

  // 3. 删除 trash 文件
  await _workspace?.deleteTrashFile(id)
  set(state => { const next = { ...state.cards }; delete next[id]; return { cards: next } })
  return true
}
```

**新项目适配**：
```typescript
// 新项目：使用 React Flow
const node: Node = {
  id: card.id,
  type: 'card',
  position: { x: card.shapeX, y: card.shapeY },
  data: { cardId: card.id },
  width: card.shapeW || DEFAULT_CARD_WIDTH,
  height: card.shapeH || DEFAULT_CARD_HEIGHT,
}
setNodes(nodes => [...nodes, node])
```

### 4.5 过期清理

```typescript
cleanExpired: async () => {
  const now = Date.now()
  const { cards } = get()
  const next: Record<string, TrashCardData> = {}
  for (const [id, card] of Object.entries(cards)) {
    if (card.expiresAt <= now) {
      await _workspace?.deleteTrashFile(id)  // 删除过期文件
    } else {
      next[id] = card  // 保留未过期
    }
  }
  set({ cards: next })
}
```

**触发时机**：工作区加载完成后调用一次。

### 4.6 TrashBinPanel UI 结构

```
TrashBinPanel（Modal 弹窗）
├── Header
│   ├── 标题 + 回收站图标 + 项目计数
│   ├── 清空回收站按钮（带二次确认）
│   └── 关闭按钮
├── Helper text（"卡片将在删除 3 天后自动清理"）
├── Grid（卡片网格）
│   └── TrashGridCard × N
│       ├── 颜色条
│       ├── 标题 + 预览文本
│       ├── 删除日期 + 剩余天数
│       └── Hover overlay（恢复 / 永久删除按钮）
└── 空状态（"回收站为空"）
```

---

## 五、设置面板（SettingsDialog）

### 5.1 核心功能

| 功能 | 说明 |
|------|------|
| **画布设置** | 网格模式、吸附模式、颜色主题（light/dark/system） |
| **工作区管理** | 切换工作区、新建工作区、在资源管理器中打开 |
| **导入导出** | 导出当前画板为 JSON、导入画板 JSON |
| **持久化** | 设置保存到 localStorage + 工作区 settings.json |

### 5.2 设置持久化双写

```typescript
const persistSettings = useCallback((patch: Record<string, unknown>) => {
  // 1. 写入 localStorage
  const current = readCanvasSettings()
  const merged = { ...current, ...patch }
  localStorage.setItem(CANVAS_SETTINGS_KEY, JSON.stringify(merged))

  // 2. 写入工作区 settings.json
  if (ws?.isOpen) {
    ws.saveSettings(merged).catch(err => console.error('[SettingsDialog] save settings:', err))
  }
}, [ws])
```

### 5.3 工作区切换

```typescript
const handleSwitchWorkspace = useCallback(async () => {
  const result = await openWorkspace()
  if (!result) return

  // 保存到最近工作区列表
  const RECENT_KEY = 'hepta-recent-workspaces'
  const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  const rootPath = result.fs.getRootPath()
  const filtered = list.filter((r: any) => r.path !== rootPath)
  filtered.unshift({
    name: result.fs.getWorkspaceName(),
    path: rootPath,
    lastOpenedAt: Date.now(),
    handleKey: 'workspace-root-dir',
  })
  localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, 10)))

  onClose()
  // 触发工作区切换事件
  window.dispatchEvent(new CustomEvent('hepta-switch-workspace'))
}, [openWorkspace, onClose])
```

---

## 六、新项目复用清单

### ✅ 完全复用（无需修改）

| 文件 | 说明 |
|------|------|
| `src/utils/libraryStore.ts` | 视图模式 + 侧栏折叠状态 |
| `src/utils/workspace/workspaceStore.ts` | 工作区 UI 状态 |
| `src/utils/trashStore.ts` | 回收站状态管理（仅恢复时的画布重建需改） |
| `src/components/ui/TrashBinPanel.tsx` | 回收站 UI（纯展示组件） |
| `src/components/ui/CardLibraryView.tsx` | 卡片库网格视图 |
| `src/components/ui/BoardLibraryView.tsx` | 画板库网格视图（预览渲染需改） |
| `src/components/ui/LibraryView.tsx` | 卡片库容器组件 |
| `src/components/ui/InspectView.tsx` | 卡片详情编辑器 |
| `src/components/ui/SharedUI.tsx` | 共享 UI 组件（SideTabButton 等） |

### ⚠️ 部分复用（需适配 React Flow）

| 文件 | 修改点 |
|------|--------|
| `src/components/ui/LeftPanel.tsx` | 去掉 `useEditor()` 和 `useValue()`，暗色模式从 theme 获取 |
| `src/components/ui/RightPanel.tsx` | 去掉 `useEditor()`，选中卡片从 React Flow 获取，创建卡片用 `setNodes()` |
| `src/components/ui/Toolbar.tsx` | 去掉所有 tldraw 引用，工具切换改为 React Flow 操作 |
| `src/components/ui/SettingsDialog.tsx` | 去掉 `useEditor()`，导出/导入适配新 snapshot 格式 |

### ❌ 不再需要的 workaround

- `App.tsx` 中的 tldraw z-index workaround（React Flow 无此问题）
- `RightPanel` 中的 `createShapeId()` 和 `editor.createShape()`
- `Toolbar` 中的 `editor.getCurrentPageShapes()` 等 tldraw API
- 所有 `useEditor()`、`useValue()`、`createShapeId()` 引用

---

## 七、关键事件汇总

| 事件名 | 触发源 | 监听者 | 说明 |
|--------|--------|--------|------|
| `hepta-switch-board` | LeftPanel、BoardLibraryView | TldrawCanvas / ReactFlowCanvas | 切换画板 |
| `hepta-switch-workspace` | SettingsDialog、WorkspacePicker | App / CanvasInner | 切换工作区 |
| `hepta-card-created` | useCanvasDoubleClick | CardShapeUtil | 新卡片创建通知 |
| `hepta-board-saved` | WorkspaceSyncEngine | （调试） | 画板保存完成 |

---

## 八、状态机最佳实践

1. **画板切换用事件，不用直接调用**：避免 LeftPanel 直接操作 canvas 状态，保持解耦
2. **搜索用 useDeferredValue**：避免输入卡顿
3. **卡片文本缓存**：BlockNote JSON 解析昂贵，用 Map 缓存 + LRU 清理
4. **双写持久化**：localStorage + 文件系统，确保设置不丢失
5. **回收站恢复重建形状**：恢复时必须在画布上重建节点，否则只有数据没有视图
6. **侧栏宽度持久化**：用户调整过的宽度应记住
