# 左右侧面板及 UI 组件设计文档

## 一、概述

本文档定义 Heptabase Canvas 应用的完整 UI 面板系统，包括左右侧面板、工具栏、设置弹窗、回收站等组件的设计规范。

---

## 二、架构设计

### 2.1 组件层次结构

```
App
├── LeftPanel（左侧面板）
│   ├── WorkspaceHeader（工作区标题栏）
│   ├── ViewModeTabs（视图模式切换）
│   ├── BoardList（画板列表）
│   ├── NewBoardInput（新建画板）
│   ├── TrashBinButton（回收站入口）
│   └── CollapseButton（折叠按钮）
│
├── MainCanvas（主画布区域）
│   ├── Toolbar（工具栏）
│   └── ReactFlowCanvas（画布）
│
├── RightPanel（右侧面板）
│   ├── TabBar（标签栏：卡片库 / 编辑器）
│   ├── ResizeHandle（宽度调整手柄）
│   ├── CardLibraryView（卡片库视图）
│   ├── CardEditorView（卡片编辑器视图）
│   └── CollapseButton（折叠按钮）
│
├── TrashBinPanel（回收站弹窗 - Modal）
├── SettingsDialog（设置弹窗 - Modal）
└── WorkspacePicker（工作区选择器 - Modal）
```

### 2.2 状态管理

```typescript
// libraryStore.ts 扩展
interface LibraryStore {
  viewMode: ViewMode                    // 'board' | 'cards' | 'boardLibrary'
  editingCardId: string | null          // 正在编辑的卡片 ID
  cardLibrarySubTab: 'cards' | 'properties'
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean
  rightPanelWidth: number                // 260-600，默认 360
  rightPanelActiveTab: 'library' | 'editor'
  userSwitchedTab: boolean               // 用户是否手动切换过标签
  
  setViewMode: (mode: ViewMode) => void
  openCardEditor: (cardId: string) => void
  closeCardEditor: () => void
  setLeftPanelCollapsed: (collapsed: boolean) => void
  setRightPanelCollapsed: (collapsed: boolean) => void
  setRightPanelWidth: (width: number) => void
  setRightPanelActiveTab: (tab: 'library' | 'editor') => void
  toggleAllSidebars: () => void         // Tab 键触发
}
```

---

## 三、左侧面板（LeftPanel）

### 3.1 布局结构

```
┌─────────────────────────────┐
│  📁 我的工作区          ⚙️  │  ← 工作区标题栏（点击展开设置浮层）
├─────────────────────────────┤
│  [画板库] [卡片库] [画布]   │  ← 视图模式切换按钮
├─────────────────────────────┤
│  📄 第一个画板        ✓    │  ← 画板列表项（当前激活）
│  📄 项目规划                │
│  📄 学习笔记                │
│  ────────────────────────  │
│  + 新建画板...              │  ← 新建画板输入
├─────────────────────────────┤
│  🗑️ 回收站 (3)              │  ← 回收站入口
└─────────────────────────────┘
```

### 3.2 交互行为

| 操作 | 行为 |
|------|------|
| 点击工作区名称 | 展开设置浮层（切换工作区、新建工作区、设置） |
| 点击视图模式按钮 | 切换到对应视图，互斥全屏切换 |
| 点击画板项 | 触发 `hepta-switch-board` 事件，切换画板 |
| 双击画板项 | 进入重命名模式，显示输入框 |
| 右键画板项 | 显示上下文菜单（重命名、删除、复制、在资源管理器打开） |
| 点击新建画板 | 显示输入框，输入名称后创建 |
| 点击回收站 | 打开回收站弹窗 |
| 点击折叠按钮 | 折叠为图标栏（56px 宽度） |

### 3.3 画板右键菜单

```typescript
const boardContextMenuItems = [
  { label: '重命名', action: 'rename' },
  { label: '删除', action: 'delete' },
  { type: 'separator' },
  { label: '复制画板', action: 'duplicate' },
  { type: 'separator' },
  { label: '在资源管理器中打开', action: 'openInExplorer' },
]
```

### 3.4 折叠状态

- 展开宽度：260px
- 折叠宽度：0px（完全隐藏）
- 折叠按钮位置：左侧面板右上角
- 折叠后：面板完全隐藏，在原位置留下独立的展开图标按钮

### 3.5 展开图标按钮（折叠后显示）

```
┌──┐
│ ◀│  ← 独立的展开图标按钮，悬浮在画布左侧边缘
└──┘
```

---

## 四、右侧面板（RightPanel）

### 4.1 布局结构

```
┌─────────────────────────────┐
│  [卡片库] [编辑器]          │  ← 标签栏
├─────────────────────────────┤
│  🔍 搜索卡片...              │  ← 搜索框（卡片库视图）
├─────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ 📄 │ │ 📄 │ │ 📄 │   │  ← 卡片网格
│  │标题 │ │标题 │ │标题 │   │
│  └─────┘ └─────┘ └─────┘   │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ 📄 │ │ 📄 │ │ 📄 │   │
│  └─────┘ └─────┘ └─────┘   │
└─────────────────────────────┘
```

### 4.2 标签页切换逻辑

```typescript
// 智能默认切换
useEffect(() => {
  if (selectedCardId && !userSwitchedTab) {
    // 用户未手动切换过，自动切到编辑器
    setRightPanelActiveTab('editor')
  }
}, [selectedCardId])

// 用户手动切换时标记
const handleTabChange = (tab: 'library' | 'editor') => {
  setUserSwitchedTab(true)
  setRightPanelActiveTab(tab)
}

// 取消选中时重置
useEffect(() => {
  if (!selectedCardId) {
    setUserSwitchedTab(false)
    setRightPanelActiveTab('library')
  }
}, [selectedCardId])
```

### 4.3 卡片拖拽到画布

```typescript
// 默认行为：引用原卡片
const handleDragStart = (card: Card, event: DragEvent) => {
  const isAltPressed = event.altKey
  
  setDragData({
    type: isAltPressed ? 'copy' : 'reference',
    cardId: card.id,
    sourceCard: isAltPressed ? null : card,
  })
}

// 画布接收
const handleDrop = (position: XYPosition) => {
  const { type, cardId, sourceCard } = dragData
  
  if (type === 'reference') {
    // 创建引用节点，共享同一卡片数据
    createCardNode(cardId, position)
  } else {
    // 创建新卡片实例
    const newCard = duplicateCard(sourceCard)
    createCardNode(newCard.id, position)
  }
}
```

### 4.4 宽度调整

- 最小宽度：260px
- 最大宽度：600px
- 默认宽度：360px
- 拖拽左边缘调整
- 宽度持久化到 localStorage

### 4.5 折叠按钮位置

- 折叠按钮位置：右侧面板左上角
- 折叠后：面板完全隐藏，在原位置留下独立的展开图标按钮

```
┌──┐
│▶ │  ← 独立的展开图标按钮，悬浮在画布右侧边缘
└──┘
```

### 4.6 卡片编辑器视图

当选中卡片时，编辑器视图显示：

```
┌─────────────────────────────┐
│  卡片预览                   │
│  ┌───────────────────────┐ │
│  │                       │ │
│  │   卡片内容预览/编辑    │ │
│  │                       │ │
│  └───────────────────────┘ │
├─────────────────────────────┤
│  颜色                       │
│  ⚪ 🟡 🔵 🟢 🩷 🟣         │
├─────────────────────────────┤
│  变体                       │
│  [实心] [玻璃] [描边]       │
├─────────────────────────────┤
│  □ 折叠                     │
│  □ 固定高度                 │
├─────────────────────────────┤
│  [移出画板]                 │
└─────────────────────────────┘
```

---

## 五、视图模式切换

### 5.1 三种视图模式

| 模式 | 显示内容 |
|------|---------|
| `board` | 画布视图（ReactFlowCanvas） |
| `cards` | 卡片库全屏网格视图 |
| `boardLibrary` | 画板库全屏网格视图 |

### 5.2 切换逻辑

```typescript
// App.tsx 中的视图切换
const renderMainContent = () => {
  switch (viewMode) {
    case 'board':
      return <ReactFlowCanvas />
    case 'cards':
      return <CardLibraryFullscreen />
    case 'boardLibrary':
      return <BoardLibraryFullscreen />
  }
}
```

---

## 六、回收站面板（TrashBinPanel）

### 6.1 布局结构

```
┌─────────────────────────────────────────┐
│  🗑️ 回收站 (3 项)           [清空] [×] │
├─────────────────────────────────────────┤
│  卡片将在删除 30 天后自动清理            │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ 📄      │ │ 📄      │ │ 📄      │   │
│  │ 标题    │ │ 标题    │ │ 标题    │   │
│  │ 预览... │ │ 预览... │ │ 预览... │   │
│  │ 2天后   │ │ 5天后   │ │ 28天后  │   │
│  │ [↩️][🗑️]│ │ [↩️][🗑️]│ │ [↩️][🗑️]│   │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
```

### 6.2 交互行为

| 操作 | 行为 |
|------|------|
| 点击恢复 | 恢复卡片到原位置，从回收站移除 |
| 点击永久删除 | 二次确认后，从文件系统删除 |
| 点击清空回收站 | 二次确认后，删除所有回收站卡片 |
| 悬停卡片 | 显示恢复/删除按钮 |

### 6.3 恢复逻辑

```typescript
const restoreCard = async (cardId: string) => {
  const trashItem = trashStore.items.find(i => i.cardId === cardId)
  if (!trashItem) return
  
  // 1. 恢复到 cardStore
  cardStore.addCard({
    id: trashItem.cardId,
    content: trashItem.content,
    color: trashItem.color,
    variant: trashItem.variant,
    createdAt: trashItem.createdAt,
  })
  
  // 2. 在画布上重建节点（原位置）
  const position = { x: trashItem.shapeX, y: trashItem.shapeY }
  
  // 检查原位置是否有重叠，如有则偏移
  const adjustedPosition = avoidOverlap(position)
  
  createCardNode(trashItem.cardId, adjustedPosition)
  
  // 3. 从回收站移除
  await workspaceService.deleteTrashFile(cardId)
  trashStore.removeItem(cardId)
}
```

---

## 七、设置面板（SettingsDialog）

### 7.1 设置项

```
┌─────────────────────────────────────────┐
│  ⚙️ 设置                           [×] │
├─────────────────────────────────────────┤
│  画布设置                               │
│  ├─ 网格模式      [开关]                │
│  ├─ 吸附到网格    [开关]                │
│  └─ 网格大小      [小、中、大]          │
├─────────────────────────────────────────┤
│  主题                                   │
│  └─ 颜色模式      [亮色、暗色、跟随系统]│
├─────────────────────────────────────────┤
│  工作区                                 │
│  ├─ [切换工作区]                        │
│  ├─ [新建工作区]                        │
│  └─ [在资源管理器中打开]                │
├─────────────────────────────────────────┤
│  导入导出                               │
│  ├─ [导出当前画板]                      │
│  └─ [导入画板]                          │
└─────────────────────────────────────────┘
```

### 7.2 持久化

```typescript
// 双写持久化
const saveSettings = (settings: Settings) => {
  // 1. 写入 localStorage
  localStorage.setItem('hepta-settings', JSON.stringify(settings))
  
  // 2. 写入工作区 settings.json
  if (workspace?.isOpen) {
    workspace.saveSettings(settings)
  }
}
```

---

## 八、工作区选择器（WorkspacePicker）

### 8.1 显示逻辑

```typescript
// 启动时
useEffect(() => {
  const lastWorkspace = localStorage.getItem('hepta-last-workspace')
  
  if (lastWorkspace) {
    // 尝试恢复
    tryRestoreWorkspace(lastWorkspace)
      .then(success => {
        if (!success) {
          setShowPicker(true)  // 恢复失败，显示选择器
        }
      })
  } else {
    setShowPicker(true)  // 没有上次工作区，显示选择器
  }
}, [])
```

### 8.2 布局结构

```
┌─────────────────────────────────────────┐
│  选择工作区                             │
├─────────────────────────────────────────┤
│  最近打开                               │
│  ┌───────────────────────────────────┐ │
│  │ 📁 我的工作区                      │ │
│  │    C:\Users\xxx\Documents\workspace│ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │ 📁 项目笔记                        │ │
│  │    D:\Projects\notes               │ │
│  └───────────────────────────────────┘ │
├─────────────────────────────────────────┤
│  [打开其他工作区]  [新建工作区]         │
└─────────────────────────────────────────┘
```

---

## 九、键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| Tab | 同时折叠/展开左右侧面板 |
| Alt + 拖拽卡片 | 创建卡片新实例（而非引用） |
| Delete | 删除选中的卡片节点 |
| Escape | 关闭弹窗/取消操作 |

---

## 十、画板切换与保存

### 10.1 切换流程

```typescript
// 画板切换事件处理
window.addEventListener('hepta-switch-board', async (e) => {
  const { boardId } = e.detail
  
  // 1. 自动保存当前画板（静默）
  await syncEngine.flushBoard()
  
  // 2. 加载目标画板
  const snapshot = await workspaceService.loadBoard(boardId)
  
  // 3. 应用到画布
  setNodes(snapshot.nodes)
  setEdges(snapshot.edges)
  setViewport(snapshot.viewport)
  
  // 4. 更新 store
  boardStore.setActiveBoardId(boardId)
})
```

---

## 十一、文件清单

### 新增文件

```
src/components/ui/
├── SharedUI.tsx           # 共享 UI 组件
├── LeftPanel.tsx          # 左侧面板
├── RightPanel.tsx         # 右侧面板
├── Toolbar.tsx            # 工具栏
├── SettingsDialog.tsx     # 设置弹窗
├── TrashBinPanel.tsx      # 回收站面板
├── WorkspacePicker.tsx    # 工作区选择器
├── CardLibraryView.tsx    # 卡片库视图
├── BoardLibraryView.tsx   # 画板库视图
└── CardEditorView.tsx     # 卡片编辑器视图
```

### 修改文件

```
src/utils/libraryStore.ts  # 扩展状态管理
src/App.tsx                # 集成所有面板
```

---

## 十二、验收标准

1. ✅ 左侧面板：画板列表、视图切换、新建/删除/重命名画板
2. ✅ 右侧面板：卡片库、编辑器、宽度调整、标签切换
3. ✅ 卡片拖拽：默认引用，Alt 创建新实例
4. ✅ 回收站：恢复到原位置、永久删除、清空
5. ✅ 设置面板：画布设置、主题、工作区、导入导出
6. ✅ 工作区选择器：自动恢复、失败时显示
7. ✅ Tab 键：同时折叠/展开两个面板
8. ✅ 画板切换：自动保存、静默切换
