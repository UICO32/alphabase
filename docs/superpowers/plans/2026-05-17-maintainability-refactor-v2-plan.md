# Heptabase Canvas 可维护性重构计划 v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 渐进式消除全局事件通信、合并重复文件服务、抽取通用面板组件、集中类型与常量管理，提升代码可维护性。

**Architecture:** 以"统一数据流"为核心：用 Zustand subscribe 替代 window CustomEvent；合并 WorkspaceService + WorkspaceSyncEngine 为统一文件管理层；抽取 ResizablePanel 消除左右面板重复代码。

**Tech Stack:** React 18 + TypeScript 5.6 + Zustand 5 + Tailwind CSS 4

**排除范围:** 卡片编辑器（BlockNoteEditor 及子组件）、卡片节点内部逻辑（CardNode、CardContent、CardActionBar 等）——用户正在修改，避免冲突。

---

## 问题总览（基于 2026-05-17 代码扫描）

| 优先级 | 类别 | 问题 | 影响文件 |
|--------|------|------|----------|
| P0 | 通信反模式 | Store/组件间用 `window.dispatchEvent(CustomEvent)` 通信，共 8+ 处 | App.tsx, useWorkspaceLifecycle.ts, useBoardActions.ts, Toolbar.tsx, ReactFlowCanvas.tsx |
| P0 | 单例全局变量 | `syncEngineRef.ts` 用模块级变量存活跃引擎 | syncEngineRef.ts |
| P1 | 面板代码重复 | LeftPanel/RightPanel 各自实现折叠动画、拖拽调整、wheel 阻止 | LeftPanel.tsx, RightPanel.tsx |
| P1 | 文件服务分裂 | WorkspaceService（读）和 WorkspaceSyncEngine（写）操作同一批文件 | WorkspaceService.ts, syncEngine.ts |
| P1 | Hook 参数管道 | ReactFlowCanvas 向 8 个 hook 传递 setNodes/setEdges/reactFlowInstance | ReactFlowCanvas.tsx, hooks/* |
| P2 | 类型定义分散 | GlobalCard 在 cardStore.ts，其他类型在 types/ | cardStore.ts, types/*.ts |
| P2 | 魔法值散布 | 卡片/面板/阈值常量分散在各文件 | CardNode.tsx, ReactFlowCanvas.tsx, libraryStore.ts |
| P2 | 调试代码未清理 | useHistory.ts 充满 console.log | useHistory.ts |
| P3 | 主题 hook 副作用 | getPanelSurface 每次渲染操作 DOM 读取 CSS 变量 | tokens.ts, usePanelSurface.ts |

---

## Phase 1: 统一事件总线（消除 window.CustomEvent）

**目标:** 将所有 `window.dispatchEvent(new CustomEvent(...))` 替换为类型安全的事件总线。

**文件结构:**
- `src/utils/eventBus.ts` — 新创建，类型安全的事件发布/订阅中心
- `src/utils/events.ts` — 新创建，所有事件名称和 payload 类型定义
- 修改涉及全局事件的文件

---

### Task 1.1: 定义事件类型和事件总线

**Files:**
- Create: `src/utils/events.ts`
- Create: `src/utils/eventBus.ts`

- [ ] **Step 1: 定义所有事件类型**

```ts
// src/utils/events.ts
export interface EventMap {
  'switch-board': { boardId: string }
  'add-card-node': { cardId: string; color: string }
  'data-ready': void
  'reinit-workspace': void
  'workspace-changed': { path: string }
  'select-folder': void
  'zoom-in': void
  'zoom-out': void
  'fit-view': void
  'open-in-explorer': { path: string }
}

export type EventName = keyof EventMap
```

- [ ] **Step 2: 实现类型安全的事件总线**

```ts
// src/utils/eventBus.ts
import type { EventMap, EventName } from './events'

type Listener<T extends EventName> = (payload: EventMap[T]) => void

const listeners = new Map<EventName, Set<Listener<EventName>>>()

export function emit<T extends EventName>(event: T, payload: EventMap[T]): void {
  const set = listeners.get(event)
  if (set) {
    set.forEach((fn) => fn(payload))
  }
}

export function on<T extends EventName>(event: T, listener: Listener<T>): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set())
  }
  listeners.get(event)!.add(listener as Listener<EventName>)
  return () => {
    listeners.get(event)?.delete(listener as Listener<EventName>)
  }
}

export function once<T extends EventName>(event: T, listener: Listener<T>): void {
  const off = on(event, ((payload: EventMap[T]) => {
    off()
    listener(payload)
  }) as Listener<T>)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/events.ts src/utils/eventBus.ts
git commit -m "feat(utils): add type-safe event bus to replace window.CustomEvent"
```

---

### Task 1.2: 替换 App.tsx 中的全局事件

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 修改 workspace-changed 事件处理**

将：
```tsx
window.addEventListener('hepta-workspace-changed', handleWorkspaceChanged)
```
替换为：
```tsx
import { on } from './utils/eventBus'
// ...
const unsub = on('workspace-changed', () => handleWorkspaceChanged())
return () => unsub()
```

- [ ] **Step 2: 修改 hepta-switch-board 事件处理**

将：
```tsx
window.addEventListener('hepta-switch-board', handleBoardSwitch)
```
替换为：
```tsx
const unsub = on('switch-board', ({ boardId }) => handleBoardSwitch(boardId))
return () => unsub()
```

- [ ] **Step 3: 修改 hepta-select-folder 事件处理**

将：
```tsx
window.addEventListener('hepta-select-folder', handleSelectFolder as EventListener)
```
替换为：
```tsx
const unsub = on('select-folder', () => handleSelectFolder())
return () => unsub()
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(app): replace window events with eventBus in App.tsx"
```

---

### Task 1.3: 替换 useWorkspaceLifecycle.ts 中的全局事件

**Files:**
- Modify: `src/hooks/useWorkspaceLifecycle.ts`

- [ ] **Step 1: 替换 hepta-reinit-workspace 事件**

将：
```tsx
window.addEventListener('hepta-reinit-workspace', handleReinit)
```
替换为：
```tsx
import { on } from '../utils/eventBus'
// ...
const unsub = on('reinit-workspace', () => handleReinit())
return () => unsub()
```

- [ ] **Step 2: 替换 hepta-switch-board 事件**

将：
```tsx
window.addEventListener('hepta-switch-board', handleBoardSwitch)
```
替换为：
```tsx
const unsub = on('switch-board', ({ boardId }) => handleBoardSwitch(boardId))
return () => unsub()
```

- [ ] **Step 3: 替换 hepta-data-ready 事件**

将：
```tsx
window.addEventListener('hepta-data-ready', handleDataReady)
```
替换为：
```tsx
const unsub = on('data-ready', () => handleDataReady())
return () => unsub()
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWorkspaceLifecycle.ts
git commit -m "refactor(hooks): replace window events with eventBus in useWorkspaceLifecycle"
```

---

### Task 1.4: 替换 useBoardActions.ts 中的全局事件发射

**Files:**
- Modify: `src/hooks/useBoardActions.ts`

- [ ] **Step 1: 替换所有 dispatchEvent 为 emit**

将：
```tsx
window.dispatchEvent(new CustomEvent('hepta-switch-board', { detail: { boardId } }))
```
替换为：
```tsx
import { emit } from '../utils/eventBus'
// ...
emit('switch-board', { boardId })
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useBoardActions.ts
git commit -m "refactor(hooks): use eventBus.emit in useBoardActions"
```

---

### Task 1.5: 替换 Toolbar.tsx 和 ReactFlowCanvas.tsx 中的全局事件

**Files:**
- Modify: `src/components/ui/Toolbar.tsx`
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 替换 Toolbar 中的 zoom 事件**

将：
```tsx
window.dispatchEvent(new CustomEvent('hepta-zoom-out'))
```
替换为：
```tsx
import { emit } from '../../utils/eventBus'
// ...
emit('zoom-out', undefined)
```

- [ ] **Step 2: 替换 ReactFlowCanvas 中的 zoom 事件监听**

将：
```tsx
window.addEventListener('hepta-zoom-in', ...)
window.addEventListener('hepta-zoom-out', ...)
window.addEventListener('hepta-fit-view', ...)
```
替换为：
```tsx
import { on } from '../../utils/eventBus'
// ...
const unsubs = [
  on('zoom-in', () => ...),
  on('zoom-out', () => ...),
  on('fit-view', () => ...),
]
return () => unsubs.forEach(u => u())
```

- [ ] **Step 3: 替换 ReactFlowCanvas 中的 add-card-node 事件**

将：
```tsx
window.addEventListener('hepta-add-card-node', onAddCardNode)
```
替换为：
```tsx
const unsub = on('add-card-node', ({ cardId, color }) => onAddCardNode({ cardId, color }))
return () => unsub()
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Toolbar.tsx src/components/canvas/ReactFlowCanvas.tsx
git commit -m "refactor(canvas/ui): replace window zoom/add-card events with eventBus"
```

---

### Task 1.6: 替换剩余全局事件并清理

**Files:**
- Modify: `src/App.tsx`（hepta-data-ready 发射）
- Modify: `src/components/ui/BoardLibraryView.tsx`
- Modify: `src/hooks/useWorkspaceDataLoader.ts`

- [ ] **Step 1: 替换所有剩余的 dispatchEvent**

逐个搜索 `dispatchEvent` 和 `CustomEvent`，替换为 `emit`。

- [ ] **Step 2: 验证无残留**

```bash
grep -r "CustomEvent" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
# 预期输出为空（或仅保留非业务用途的）
```

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(all): complete migration from window.CustomEvent to eventBus"
```

---

## Phase 2: 合并文件服务层（WorkspaceService + WorkspaceSyncEngine）

**目标:** 将读取（WorkspaceService）和写入（WorkspaceSyncEngine）合并为统一的 WorkspaceFileManager，消除调用方同时使用两个类的负担。

**文件结构:**
- `src/services/WorkspaceFileManager.ts` — 新创建，合并读写能力
- `src/services/WorkspaceService.ts` — 删除
- `src/utils/workspace/syncEngine.ts` — 删除
- 修改所有调用方

---

### Task 2.1: 创建 WorkspaceFileManager

**Files:**
- Create: `src/services/WorkspaceFileManager.ts`

- [ ] **Step 1: 实现合并后的文件管理器**

```ts
import { readJSON, writeJSON, exists, readdir, mkdir, deleteFile, writeFile, rename } from '../utils/workspace/fs'
import type { BoardManifest, BoardSnapshot, CardFile, TrashFile, WorkspaceMetadata } from '../utils/workspace/types'

export class WorkspaceFileManager {
  private workspacePath: string = ''
  private cardsDir: string = ''
  private boardsDir: string = ''
  private trashDir: string = ''
  private pendingWrites = new Map<string, { data: string; timer: ReturnType<typeof setTimeout> }>()
  private running = false

  setWorkspacePath(path: string) {
    this.workspacePath = path
    this.cardsDir = joinPath(path, 'cards')
    this.boardsDir = joinPath(path, 'boards')
    this.trashDir = joinPath(path, 'trash')
  }

  getWorkspacePath() { return this.workspacePath }

  async init() {
    for (const dir of [this.cardsDir, this.boardsDir, this.trashDir]) {
      if (!(await exists(dir))) await mkdir(dir)
    }
    this.running = true
  }

  stop() {
    this.running = false
    for (const [, { timer }] of this.pendingWrites) clearTimeout(timer)
    this.flushAll()
  }

  isRunning() { return this.running }

  // --- Read operations (from WorkspaceService) ---

  async loadManifest(): Promise<BoardManifest> {
    const path = joinPath(this.boardsDir, '_manifest.json')
    if (!(await exists(path))) {
      const empty: BoardManifest = { boards: [] }
      await writeJSON(path, empty)
      return empty
    }
    return readJSON<BoardManifest>(path)
  }

  async saveManifest(manifest: BoardManifest): Promise<void> {
    await writeJSON(joinPath(this.boardsDir, '_manifest.json'), manifest)
  }

  async loadBoard(boardId: string): Promise<BoardSnapshot | null> {
    const path = joinPath(this.boardsDir, `${boardId}.json`)
    if (!(await exists(path))) return null
    return readJSON<BoardSnapshot>(path)
  }

  async loadCard(cardId: string): Promise<CardFile | null> {
    const path = joinPath(this.cardsDir, `${cardId}.json`)
    if (!(await exists(path))) return null
    return readJSON<CardFile>(path)
  }

  async loadAllCards(): Promise<CardFile[]> {
    if (!(await exists(this.cardsDir))) return []
    const files = await readdir(this.cardsDir)
    const cards: CardFile[] = []
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try { cards.push(await readJSON<CardFile>(joinPath(this.cardsDir, file))) }
      catch (e) { console.warn(`Failed to load card ${file}:`, e) }
    }
    return cards
  }

  async loadAllTrash(): Promise<TrashFile[]> {
    if (!(await exists(this.trashDir))) return []
    const files = await readdir(this.trashDir)
    const items: TrashFile[] = []
    for (const file of files.filter(f => f.endsWith('.trash.json'))) {
      try { items.push(await readJSON<TrashFile>(joinPath(this.trashDir, file))) }
      catch (e) { console.warn(`Failed to load trash ${file}:`, e) }
    }
    return items
  }

  // --- Write operations (from WorkspaceSyncEngine) ---

  scheduleWriteCard(card: CardFile, debounceMs = 500) {
    const path = joinPath(this.cardsDir, `${card.id}.json`)
    this.scheduleWrite(path, JSON.stringify(card, null, 2), debounceMs)
  }

  scheduleDeleteCard(cardId: string) {
    this.scheduleDelete(joinPath(this.cardsDir, `${cardId}.json`))
  }

  scheduleWriteBoard(boardId: string, snapshot: BoardSnapshot, debounceMs = 600) {
    const path = joinPath(this.boardsDir, `${boardId}.json`)
    this.scheduleWrite(path, JSON.stringify(snapshot, null, 2), debounceMs)
  }

  scheduleWriteManifest(manifest: BoardManifest, debounceMs = 300) {
    const path = joinPath(this.boardsDir, '_manifest.json')
    this.scheduleWrite(path, JSON.stringify(manifest, null, 2), debounceMs)
  }

  scheduleWriteTrash(item: TrashFile, debounceMs = 500) {
    const path = joinPath(this.trashDir, `${item.cardId}.trash.json`)
    this.scheduleWrite(path, JSON.stringify(item, null, 2), debounceMs)
  }

  scheduleDeleteTrashFile(cardId: string) {
    this.scheduleDelete(joinPath(this.trashDir, `${cardId}.trash.json`))
  }

  private scheduleWrite(path: string, data: string, debounceMs: number) {
    if (!this.running) return
    const existing = this.pendingWrites.get(path)
    if (existing) clearTimeout(existing.timer)
    this.pendingWrites.set(path, { data, timer: setTimeout(() => this.executeWrite(path, path, data), debounceMs) })
  }

  private scheduleDelete(path: string) {
    if (!this.running) return
    const key = `delete:${path}`
    const existing = this.pendingWrites.get(key)
    if (existing) clearTimeout(existing.timer)
    this.pendingWrites.set(key, { data: '__DELETE__', timer: setTimeout(() => this.executeWrite(key, path, '__DELETE__'), 0) })
  }

  private async executeWrite(key: string, path: string, data: string) {
    this.pendingWrites.delete(key)
    if (!this.running && data === '__DELETE__') return
    try {
      if (data === '__DELETE__') {
        if (await exists(path)) await deleteFile(path)
      } else {
        const tmpPath = path + '.tmp'
        await writeFile(tmpPath, data)
        await rename(tmpPath, path)
      }
    } catch { /* noop */ }
  }

  flushAll() {
    const entries = [...this.pendingWrites.entries()]
    for (const [, { timer }] of entries) clearTimeout(timer)
    this.pendingWrites.clear()
    for (const [key, { data }] of entries) {
      const path = key.startsWith('delete:') ? key.slice(7) : key
      if (data === '__DELETE__') {
        exists(path).then(e => { if (e) deleteFile(path) }).catch(() => {})
      } else {
        const tmpPath = path + '.tmp'
        writeFile(tmpPath, data).then(() => rename(tmpPath, path)).catch(() => {})
      }
    }
  }
}

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\\/g, '/')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/WorkspaceFileManager.ts
git commit -m "feat(services): create WorkspaceFileManager merging read+write operations"
```

---

### Task 2.2: 迁移 useWorkspaceDataLoader 使用新类

**Files:**
- Modify: `src/hooks/useWorkspaceDataLoader.ts`

- [ ] **Step 1: 替换 WorkspaceService + WorkspaceSyncEngine 为 WorkspaceFileManager**

将：
```ts
import { WorkspaceService } from '../services/WorkspaceService'
import { WorkspaceSyncEngine } from '../utils/workspace'
```
替换为：
```ts
import { WorkspaceFileManager } from '../services/WorkspaceFileManager'
```

将 `new WorkspaceService()` + `service.setWorkspacePath()` + `new WorkspaceSyncEngine()` + `syncEngine.init()` 替换为：
```ts
const fileManager = new WorkspaceFileManager()
fileManager.setWorkspacePath(workspacePath)
await fileManager.init()
setActiveFileManager(fileManager) // 替换 setActiveSyncEngine
```

- [ ] **Step 2: 替换所有 service.loadXXX() 和 syncEngine.scheduleXXX() 调用**

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWorkspaceDataLoader.ts
git commit -m "refactor(hooks): migrate useWorkspaceDataLoader to WorkspaceFileManager"
```

---

### Task 2.3: 迁移 subscribeStores 使用新类

**Files:**
- Modify: `src/utils/subscribeStores.ts`

- [ ] **Step 1: 修改类型导入**

将 `WorkspaceSyncEngine` 替换为 `WorkspaceFileManager`。

- [ ] **Step 2: 替换 scheduleWriteXXX 调用**

- [ ] **Step 3: Commit**

```bash
git add src/utils/subscribeStores.ts
git commit -m "refactor(utils): migrate subscribeStores to WorkspaceFileManager"
```

---

### Task 2.4: 更新 syncEngineRef 并删除旧文件

**Files:**
- Modify: `src/utils/syncEngineRef.ts`
- Delete: `src/services/WorkspaceService.ts`
- Delete: `src/utils/workspace/syncEngine.ts`

- [ ] **Step 1: 更新 syncEngineRef 为 fileManagerRef**

```ts
import type { WorkspaceFileManager } from '../services/WorkspaceFileManager'

let activeManager: WorkspaceFileManager | null = null

export function setActiveFileManager(manager: WorkspaceFileManager | null) {
  activeManager = manager
}

export function getActiveFileManager(): WorkspaceFileManager | null {
  return activeManager
}

export function stopActiveFileManager() {
  if (activeManager) {
    activeManager.stop()
    activeManager = null
  }
}
```

- [ ] **Step 2: 更新所有引用 syncEngineRef 的文件**

搜索 `syncEngineRef`、`setActiveSyncEngine`、`getActiveSyncEngine`、`stopActiveSyncEngine` 并替换。

- [ ] **Step 3: 删除旧文件**

```bash
git rm src/services/WorkspaceService.ts
git rm src/utils/workspace/syncEngine.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/syncEngineRef.ts
git commit -m "refactor(services): replace syncEngineRef with fileManagerRef, delete old services"
```

---

## Phase 3: 抽取通用 ResizablePanel 组件

**目标:** 消除 LeftPanel 和 RightPanel 中重复的折叠动画、拖拽调整、wheel 阻止逻辑。

**文件结构:**
- `src/components/ui/ResizablePanel.tsx` — 新创建，通用可调整面板
- Modify: `src/components/ui/LeftPanel.tsx`
- Modify: `src/components/ui/RightPanel.tsx`

---

### Task 3.1: 创建 ResizablePanel 组件

**Files:**
- Create: `src/components/ui/ResizablePanel.tsx`

- [ ] **Step 1: 实现通用面板组件**

```tsx
import { useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { PanelRightOpen, PanelLeftOpen } from 'lucide-react'

interface ResizablePanelProps {
  side: 'left' | 'right'
  width: number
  minWidth?: number
  maxWidth?: number
  collapsed: boolean
  onCollapse: () => void
  onResize: (width: number) => void
  children: React.ReactNode
  className?: string
}

export function ResizablePanel({
  side,
  width,
  minWidth = 260,
  maxWidth = 600,
  collapsed,
  onCollapse,
  onResize,
  children,
  className = '',
}: ResizablePanelProps) {
  const surface = usePanelSurface()
  const isDragging = useRef(false)

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    isDragging.current = true
    const startX = e.clientX
    const startWidth = width
    const onMove = (ev: PointerEvent) => {
      if (!isDragging.current) return
      const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta))
      onResize(newWidth)
    }
    const onUp = () => {
      isDragging.current = false
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [width, side, minWidth, maxWidth, onResize])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
  }, [])

  const isLeft = side === 'left'
  const resizeHandleSide = isLeft ? 'right' : 'left'

  return (
    <>
      <motion.div
        className={`${isLeft ? 'absolute left-0 top-0 bottom-0' : 'absolute right-0 top-0 bottom-0'} z-10 flex flex-col overflow-hidden ${className}`}
        style={{ width, backgroundColor: surface.panelBg }}
        animate={{ x: collapsed ? (isLeft ? -width : width) : 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onWheel={handleWheel}
      >
        <div
          className={`absolute ${resizeHandleSide}-0 top-0 bottom-0 z-20 cursor-col-resize`}
          style={{ width: 4 }}
          onPointerDown={handleResizeStart}
        />
        {children}
      </motion.div>

      {collapsed && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          onClick={() => onCollapse()}
          className={`fixed top-10 ${isLeft ? 'left-2' : 'right-2'} z-50 flex items-center justify-center h-7 px-2 rounded-md cursor-pointer shadow-md`}
          style={{
            backgroundColor: surface.panelBg,
            color: surface.muted,
            border: `1px solid ${surface.divider}`,
          }}
        >
          {isLeft ? <PanelLeftOpen size={16} /> : <PanelRightOpen size={16} />}
        </motion.button>
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/ResizablePanel.tsx
git commit -m "feat(ui): add ResizablePanel component for left/right panels"
```

---

### Task 3.2: 重构 LeftPanel 使用 ResizablePanel

**Files:**
- Modify: `src/components/ui/LeftPanel.tsx`

- [ ] **Step 1: 移除折叠动画、拖拽、wheel 逻辑**

删除 `motion.div` 包裹层、`handleWheel`、`CollapseButton` 相关逻辑。

- [ ] **Step 2: 使用 ResizablePanel 包裹内容**

```tsx
<ResizablePanel
  side="left"
  width={SIDEBAR_WIDTH}
  collapsed={leftPanelCollapsed}
  onCollapse={() => setLeftPanelCollapsed(false)}
  onResize={() => {}} // LeftPanel 当前不支持拖拽调整
>
  {/* 原有内容 */}
</ResizablePanel>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/LeftPanel.tsx
git commit -m "refactor(ui): LeftPanel use ResizablePanel"
```

---

### Task 3.3: 重构 RightPanel 使用 ResizablePanel

**Files:**
- Modify: `src/components/ui/RightPanel.tsx`

- [ ] **Step 1: 移除折叠动画、拖拽、wheel 逻辑**

- [ ] **Step 2: 使用 ResizablePanel 包裹内容**

```tsx
<ResizablePanel
  side="right"
  width={rightPanelWidth}
  minWidth={SIDEBAR_WIDTH_MIN}
  maxWidth={SIDEBAR_WIDTH_MAX}
  collapsed={rightPanelCollapsed}
  onCollapse={() => setRightPanelCollapsed(false)}
  onResize={setRightPanelWidth}
>
  {/* 原有内容 */}
</ResizablePanel>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/RightPanel.tsx
git commit -m "refactor(ui): RightPanel use ResizablePanel"
```

---

## Phase 4: 集中类型定义和常量管理

**目标:** 将分散的类型和常量集中到统一目录。

---

### Task 4.1: 移动 GlobalCard 到 types/card.ts

**Files:**
- Modify: `src/types/card.ts`
- Modify: `src/utils/cardStore.ts`

- [ ] **Step 1: 在 types/card.ts 中定义 GlobalCard**

```ts
import type { CardColor } from './card' // 已有

export interface GlobalCard {
  id: string
  content: string
  color: CardColor
  createdAt: number
  updatedAt?: number
  enforceInitialHeading?: boolean
  fixedHeight?: boolean
  collapsed?: boolean
  title?: string
  previewHTML?: string
  deletedAt?: number
  tags?: string[]
  flomoSlug?: string
}
```

- [ ] **Step 2: cardStore.ts 改为从 types/card.ts 导入**

```ts
import type { GlobalCard } from '../types/card'
```

- [ ] **Step 3: Commit**

```bash
git add src/types/card.ts src/utils/cardStore.ts
git commit -m "refactor(types): move GlobalCard to types/card.ts"
```

---

### Task 4.2: 创建 constants.ts 集中管理魔法值

**Files:**
- Create: `src/constants.ts`

- [ ] **Step 1: 收集所有常量**

```ts
// Panel dimensions
export const SIDEBAR_WIDTH_MIN = 260
export const SIDEBAR_WIDTH_MAX = 600
export const SIDEBAR_WIDTH_DEFAULT = 360
export const SIDEBAR_WIDTH = 260 // LeftPanel fixed width

// Card dimensions
export const DEFAULT_CARD_WIDTH = 280
export const DEFAULT_CARD_HEIGHT = 200
export const COLLAPSED_CARD_HEIGHT = 80

// Canvas
export const PROXIMITY_THRESHOLD = 60

// History
export const MAX_HISTORY_ENTRIES = 20
export const HISTORY_DEBOUNCE_MS = 300

// Sync
export const SYNC_DEBOUNCE_MS = 500
export const BOARD_SYNC_DEBOUNCE_MS = 600
export const MANIFEST_SYNC_DEBOUNCE_MS = 300

// Trash
export const TRASH_EXPIRY_DAYS = 30
export const MAX_BACKUPS = 10
```

- [ ] **Step 2: 替换各文件中的魔法值**

涉及文件：`libraryStore.ts`、`CardNode.tsx`、`ReactFlowCanvas.tsx`、`useHistory.ts`、`syncEngine.ts`（或新文件）、`trashStore.ts`、`backupStore.ts`。

- [ ] **Step 3: Commit**

```bash
git add src/constants.ts
git commit -m "refactor(constants): centralize magic values in constants.ts"
```

---

## Phase 5: 清理调试代码与优化主题

---

### Task 5.1: 清理 useHistory.ts 中的 console.log

**Files:**
- Modify: `src/hooks/useHistory.ts`

- [ ] **Step 1: 删除或条件化所有 console.log**

```ts
const DEBUG = false
// ...
if (DEBUG) console.log('[useHistory] ...')
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useHistory.ts
git commit -m "refactor(hooks): remove debug logs from useHistory"
```

---

### Task 5.2: 优化 usePanelSurface 避免 DOM 副作用

**Files:**
- Modify: `src/theme/tokens.ts`
- Modify: `src/hooks/usePanelSurface.ts`

- [ ] **Step 1: 将 getPanelSurface 改为纯函数，不操作 DOM**

```ts
export function getPanelSurface(isDarkMode: boolean): PanelSurface {
  // 不操作 DOM，直接返回基于 isDarkMode 的硬编码值
  // 或使用 CSS 自定义属性在组件层绑定
  return {
    appBg: isDarkMode ? '#0f0f10' : '#f8f9fa',
    panelBg: isDarkMode ? '#1a1a1c' : '#ffffff',
    // ...
  }
}
```

或更好的方案：在 `index.css` 中定义好所有主题变量，组件直接使用 CSS 变量，不通过 JS 读取。

- [ ] **Step 2: Commit**

```bash
git add src/theme/tokens.ts src/hooks/usePanelSurface.ts
git commit -m "perf(theme): remove DOM side effects from getPanelSurface"
```

---

## Phase 6: 验证与回归测试

---

### Task 6.1: 运行类型检查

- [ ] **Step 1: 运行 TypeScript 检查**

```bash
pnpm typecheck
# 或
npx tsc --noEmit
```

- [ ] **Step 2: 修复所有类型错误**

---

### Task 6.2: 运行 E2E 测试

- [ ] **Step 1: 运行 Playwright 测试**

```bash
pnpm test:e2e
# 或
npx playwright test
```

- [ ] **Step 2: 修复失败的测试**

---

### Task 6.3: 手动验证核心流程

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm dev
```

- [ ] **Step 2: 验证以下功能**

- [ ] 工作区切换正常
- [ ] 画板切换正常
- [ ] 左侧面板折叠/展开正常
- [ ] 右侧面板折叠/展开、拖拽调整宽度正常
- [ ] 卡片添加/删除/编辑正常
- [ ] 画布缩放（按钮+滚轮）正常
- [ ] 连接创建/重连/删除正常
- [ ] 撤销/重做正常
- [ ] 主题切换正常

---

## 执行顺序与依赖

```
Phase 1 (事件总线)
  ├── Task 1.1 (定义事件总线)
  ├── Task 1.2 (App.tsx)
  ├── Task 1.3 (useWorkspaceLifecycle)
  ├── Task 1.4 (useBoardActions)
  ├── Task 1.5 (Toolbar + ReactFlowCanvas)
  └── Task 1.6 (清理剩余)
       │
       ▼
Phase 2 (合并文件服务)
  ├── Task 2.1 (创建 WorkspaceFileManager)
  ├── Task 2.2 (迁移 useWorkspaceDataLoader)
  ├── Task 2.3 (迁移 subscribeStores)
  └── Task 2.4 (更新 syncEngineRef + 删除旧文件)
       │
       ▼
Phase 3 (抽取 ResizablePanel)
  ├── Task 3.1 (创建组件)
  ├── Task 3.2 (重构 LeftPanel)
  └── Task 3.3 (重构 RightPanel)
       │
       ▼
Phase 4 (类型与常量)
  ├── Task 4.1 (GlobalCard 移动)
  └── Task 4.2 (constants.ts)
       │
       ▼
Phase 5 (清理与优化)
  ├── Task 5.1 (清理 console.log)
  └── Task 5.2 (优化 usePanelSurface)
       │
       ▼
Phase 6 (验证)
  ├── Task 6.1 (类型检查)
  ├── Task 6.2 (E2E 测试)
  └── Task 6.3 (手动验证)
```

**关键依赖:**
- Phase 1 必须在 Phase 2 之前完成（事件总线是基础通信设施）
- Phase 2 必须在 Phase 3 之前完成（useWorkspaceDataLoader 使用文件服务）
- Phase 3 和 Phase 4 互相独立，可并行
- Phase 5 可在任何时候执行
- Phase 6 必须在所有修改完成后执行

---

## 风险控制

- 每个 Task 完成后运行 `pnpm dev` 验证无报错
- 每个 Phase 完成后运行 `git diff --stat` 确认修改范围可控
- 保留旧文件直到新文件完全替换（如 WorkspaceService.ts 在 Task 2.4 才删除）
- 不改变任何组件的外部 props API
- 不改变任何 store 的公开接口（只改内部实现）
- 如果某 Task 影响范围过大，可拆分为更小的子 Task
