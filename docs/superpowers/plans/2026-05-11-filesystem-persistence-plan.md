# 文件系统持久化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将数据持久化从 localStorage 迁移到文件系统，实现跨会话持久存储

**架构:** WorkspaceSyncEngine 订阅 Zustand store 变更 → 防抖写入磁盘 JSON 文件；启动时 WorkspaceService 读取文件 → 灌入 store

**Tech Stack:** Electron IPC, Zustand subscribe, fs/promises

---

### Task 1: 添加 rename IPC 和 FSAdapter 原子写入支持

**Files:**
- Modify: `electron/main.ts` — 添加 `fs:rename` IPC handler
- Modify: `electron/preload.ts` — 暴露 `rename` 到 `electronAPI.fs`
- Modify: `src/utils/workspace/fs.ts` — 添加 `rename` 到 `FSAdapter` 接口

- [ ] **Step 1: 在 `electron/main.ts` 添加 rename handler**

在 `fs:exists` handler 之后添加：
```ts
ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string) => {
  const fs = await import('fs/promises')
  await fs.rename(oldPath, newPath)
})
```

- [ ] **Step 2: 在 `electron/preload.ts` 暴露 rename**

在 `fs` 对象中加入：
```ts
rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
```

- [ ] **Step 3: 在 `src/utils/workspace/fs.ts` 的 `FSAdapter` 接口添加 rename**

```ts
rename: (oldPath: string, newPath: string) => Promise<void>
```

在 `getFSAdapter` 之后添加封装函数：
```ts
export async function rename(oldPath: string, newPath: string): Promise<void> {
  await getFSAdapter().rename(oldPath, newPath)
}
```

在模块导出中确保 `rename` 已导出（检查 `index.ts` 同时导出）。

- [ ] **Step 4: 验证**

```bash
grep -n "rename" electron/main.ts electron/preload.ts src/utils/workspace/fs.ts src/utils/workspace/index.ts
```
确保所有文件一致，`rename` 出现在 `FSAdapter` 接口、preload、IPC handler 和 index 导出中。

---

### Task 2: 添加回收站加载/清理到 WorkspaceService

**Files:**
- Modify: `src/utils/workspace/types.ts` — 添加 `TrashFile` 类型
- Modify: `src/services/WorkspaceService.ts` — 添加 trash 加载/清理方法

- [ ] **Step 1: 在 `src/utils/workspace/types.ts` 添加 TrashFile 类型**

```ts
export interface TrashFile {
  id: string
  cardId: string
  title: string
  deletedAt: number
  expiresAt: number
  content: string
}
```

- [ ] **Step 2: 在 `WorkspaceService.ts` 添加 trash 加载/清理方法**

在 `deleteCard` 方法之后添加：

```ts
// --- Trash ---

async loadAllTrash(): Promise<TrashFile[]> {
  const dir = `${this.workspacePath}/trash`
  if (!(await exists(dir))) return []
  const files = await readdir(dir)
  const jsonFiles = files.filter((f) => f.endsWith('.trash.json'))
  const items: TrashFile[] = []
  for (const file of jsonFiles) {
    try {
      const item = await readJSON<TrashFile>(`${dir}/${file}`)
      items.push(item)
    } catch (e) {
      console.warn(`Failed to load trash ${file}:`, e)
    }
  }
  return items
}

async cleanExpiredTrash(): Promise<number> {
  const dir = `${this.workspacePath}/trash`
  if (!(await exists(dir))) return 0
  const files = await readdir(dir)
  const now = Date.now()
  let cleaned = 0
  for (const file of files) {
    if (!file.endsWith('.trash.json')) continue
    try {
      const item = await readJSON<TrashFile>(`${dir}/${file}`)
      if (item.expiresAt <= now) {
        const { deleteFile } = await import('../utils/workspace/fs')
        await deleteFile(`${dir}/${file}`)
        cleaned++
      }
    } catch {
      // If parsing fails, skip
    }
  }
  return cleaned
}
```

- [ ] **Step 3: 在 `index.ts` 导出 `TrashFile`**

```ts
export type { ... TrashFile ... } from './types'
```

---

### Task 3: syncEngine 添加原子写入 + 回收站支持

**Files:**
- Modify: `src/utils/workspace/syncEngine.ts`

- [ ] **Step 1: 添加原子写入和回收站方法**

将 `executeWrite` 中的 `writeFile` 替换为原子写入：

```ts
import { writeFile, deleteFile, exists, mkdir, rename } from './fs'
```

在 `scheduleWriteManifest` 之后添加：

```ts
scheduleWriteTrash(item: TrashFile, debounceMs = 500) {
  const path = joinPath(this.trashDir, `${item.cardId}.trash.json`)
  this.scheduleWrite(path, JSON.stringify(item, null, 2), debounceMs)
}

scheduleDeleteTrashFile(cardId: string) {
  const path = joinPath(this.trashDir, `${cardId}.trash.json`)
  const key = `delete:${path}`
  const existing = this.pendingWrites.get(key)
  if (existing) clearTimeout(existing.timer)
  this.pendingWrites.set(key, {
    data: '__DELETE__',
    timer: setTimeout(() => this.executeWrite(key, path, '__DELETE__'), 0),
  })
}
```

修改 `executeWrite` 中非删除的分支，使用原子写入：

```ts
if (data === '__DELETE__') {
  if (await exists(path)) await deleteFile(path)
} else {
  const tmpPath = path + '.tmp'
  await writeFile(tmpPath, data)
  await rename(tmpPath, path)
}
```

---

### Task 4: 移除所有 store 的 localStorage persist 中间件

**Files:**
- Modify: `src/utils/cardStore.ts`
- Modify: `src/utils/boardStore.ts`
- Modify: `src/utils/libraryStore.ts`

- [ ] **Step 1: cardStore — 移除 persist, 保留结构不变**

```ts
import { create } from 'zustand'
// 移除: import { persist } from 'zustand/middleware'

export const useCardStore = create<CardStore>()(
  // 移除 persist 包裹
  (set, get) => ({
    cards: {},
    isLoaded: false,
    // ... 所有方法不变 ...
  })
)
```

注意：`loadCardsFromDB` 暂时保留为空操作，后续 Task 6 重写。

- [ ] **Step 2: boardStore — 移除 persist**

同样移除 `persist` 包裹，保留所有方法和初始状态。

- [ ] **Step 3: libraryStore — 移除 persist**

同样移除 `persist` 包裹，保留所有方法和初始状态。

注意：`libraryStore` 的 `partialize` 字段（viewMode, isDarkMode 等 UI 偏好）将迁移到 `settings.json`，但不要在这个任务里动逻辑，只移除 persist 中间件。

---

### Task 5: 实现 loadCardsFromDB

**Files:**
- Modify: `src/utils/cardStore.ts`

- [ ] **Step 1: 修改 `loadCardsFromDB`，接收 card 数组并加载**

cardStore 作为纯状态容器，不应该直接依赖 fs/service。改为接收数据的方法：

```ts
loadCardsFromDB: async (cards?: Record<string, GlobalCard>) => {
  if (get().isLoaded) return
  if (cards) {
    const withPreviews: Record<string, GlobalCard> = {}
    for (const [id, card] of Object.entries(cards)) {
      withPreviews[id] = ensurePreviewHTML(card)
    }
    set({ cards: withPreviews, isLoaded: true })
  } else {
    set({ isLoaded: true })
  }
},
```

同时更新 `CardStore` 接口的 `loadCardsFromDB` 签名：
```ts
loadCardsFromDB: (cards?: Record<string, GlobalCard>) => Promise<void>
```

---

### Task 6: 重写 useWorkspaceLifecycle 为真实文件加载

**Files:**
- Modify: `src/hooks/useWorkspaceLifecycle.ts`

这是最核心的任务。将硬编码演示数据替换为真实文件系统加载。

- [ ] **Step 1: 在文件顶部添加导入**

```ts
import { WorkspaceService } from '../services/WorkspaceService'
import { WorkspaceSyncEngine, initElectronFSAdapter, cardFileToGlobalCard } from '../utils/workspace'
```

- [ ] **Step 2: 用新实现替换整个 hook**

替换 `createDemoCardContent`、`ensureGlobalDemoCards`、`ensureDefaultBoard` 等演示函数和 hook 内容：

```ts
import { useEffect, useRef, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useCardStore } from '../utils/cardStore'
import { useBoardStore } from '../utils/boardStore'
import { WorkspaceService } from '../services/WorkspaceService'
import { WorkspaceSyncEngine, initElectronFSAdapter, cardFileToGlobalCard } from '../utils/workspace'

interface UseWorkspaceLifecycleOptions {
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  nodesRef: React.RefObject<Node[]>
}

const LAST_WORKSPACE_KEY = 'hepta-last-workspace-path'

function defaultBoardNodes(boardId: string) {
  return {
    nodes: [] as Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown>; width?: number; height?: number }>,
    edges: [] as Array<{ id: string; source: string; target: string; type?: string }>,
  }
}

export function useWorkspaceLifecycle({ setNodes, setEdges, nodesRef }: UseWorkspaceLifecycleOptions) {
  const booted = useRef(false)
  const syncEngineRef = useRef<WorkspaceSyncEngine | null>(null)
  const activeBoardIdRef = useRef<string | null>(null)

  const switchToBoard = useCallback((boardId: string) => {
    const boardStore = useBoardStore.getState()

    if (activeBoardIdRef.current === boardId) return

    // 保存当前画板数据
    if (activeBoardIdRef.current && nodesRef.current) {
      boardStore.saveBoardData(activeBoardIdRef.current, {
        nodes: nodesRef.current.map(n => ({
          id: n.id, type: n.type || 'card',
          position: { ...n.position }, data: { ...n.data },
          width: n.width as number | undefined, height: n.height as number | undefined,
        })),
        edges: [],
      })
    }

    activeBoardIdRef.current = boardId

    let boardData = boardStore.getBoardData(boardId)
    if (!boardData) {
      boardData = defaultBoardNodes(boardId)
      boardStore.saveBoardData(boardId, boardData)
    }

    setNodes(boardData.nodes as Node[])
    setEdges(boardData.edges as Edge[])
  }, [setNodes, setEdges, nodesRef])

  useEffect(() => {
    const handleBoardSwitch = (e: Event) => {
      const boardId = (e as CustomEvent).detail?.boardId
      if (boardId && activeBoardIdRef.current !== boardId) {
        useBoardStore.getState().setActiveBoard(boardId)
        switchToBoard(boardId)
      }
    }

    window.addEventListener('hepta-switch-board', handleBoardSwitch)
    return () => window.removeEventListener('hepta-switch-board', handleBoardSwitch)
  }, [switchToBoard])

  useEffect(() => {
    if (booted.current) return
    booted.current = true

    ;(async () => {
      // 1. 初始化文件系统适配器
      initElectronFSAdapter()

      const service = new WorkspaceService()

      // 2. 获取或选择工作区路径
      let workspacePath = localStorage.getItem(LAST_WORKSPACE_KEY)

      if (!workspacePath) {
        const { openDirectory } = (window as unknown as { electronAPI?: { dialog: { openDirectory: () => Promise<string | null> } } }).electronAPI?.dialog || {}
        if (openDirectory) {
          const result = await openDirectory()
          if (result) {
            workspacePath = result
            localStorage.setItem(LAST_WORKSPACE_KEY, workspacePath)
          }
        }
      }

      if (!workspacePath) {
        // 没有工作区路径时使用演示模式
        console.warn('No workspace selected, using demo mode')
        useCardStore.getState().loadCardsFromDB()
        return
      }

      service.setWorkspacePath(workspacePath)

      // 3. 初始化 syncEngine
      const syncEngine = new WorkspaceSyncEngine()
      await syncEngine.init(workspacePath)
      syncEngineRef.current = syncEngine

      // 4. 加载画板清单
      const manifest = await service.loadManifest()
      useBoardStore.getState().setBoards(manifest.boards)

      // 5. 加载所有卡片
      const cardFiles = await service.loadAllCards()
      const globalCards: Record<string, ReturnType<typeof cardFileToGlobalCard>> = {}
      for (const cf of cardFiles) {
        globalCards[cf.id] = cardFileToGlobalCard(cf)
      }
      await useCardStore.getState().loadCardsFromDB(globalCards)

      // 6. 加载每个画板的快照
      for (const board of manifest.boards) {
        const snapshot = await service.loadBoard(board.id)
        if (snapshot) {
          useBoardStore.getState().saveBoardData(board.id, {
            nodes: snapshot.nodes,
            edges: snapshot.edges,
          })
        }
      }

      // 7. 加载回收站
      const trashItems = await service.loadAllTrash()
      const trashStore = (await import('../utils/trashStore')).useTrashStore
      for (const item of trashItems) {
        trashStore.getState().addItem({
          id: item.id,
          cardId: item.cardId,
          title: item.title,
          content: item.content,
        })
      }

      // 8. 清理过期回收站
      await service.cleanExpiredTrash()

      // 9. 切换到当前画板
      const activeId = useBoardStore.getState().activeBoardId
      if (activeId) {
        switchToBoard(activeId)
      }
    })()
  }, [switchToBoard])

  // 返回 syncEngine 引用，供外部订阅用
  return syncEngineRef
}
```

---

### Task 7: 订阅 store 变更到 syncEngine

**Files:**
- Create: `src/utils/subscribeStores.ts`
- Modify: `src/App.tsx`（或调用 useWorkspaceLifecycle 的地方）

- [ ] **Step 1: 创建 `src/utils/subscribeStores.ts`**

```ts
import type { WorkspaceSyncEngine } from './workspace/syncEngine'
import { useCardStore } from './cardStore'
import { useBoardStore } from './boardStore'
import { useTrashStore } from './trashStore'
import { globalCardToCardFile } from './workspace/cardConverter'

export function subscribeCardStore(syncEngine: WorkspaceSyncEngine) {
  let prevCards = useCardStore.getState().cards
  
  return useCardStore.subscribe((state) => {
    const cards = state.cards
    
    // 检查新增或更新的卡片
    for (const id in cards) {
      if (cards[id] !== prevCards[id]) {
        const cardFile = globalCardToCardFile(cards[id])
        syncEngine.scheduleWriteCard(cardFile)
      }
    }
    
    // 检查删除的卡片
    for (const id in prevCards) {
      if (!(id in cards)) {
        syncEngine.scheduleDeleteCard(id)
      }
    }
    
    prevCards = cards
  })
}

export function subscribeBoardStore(syncEngine: WorkspaceSyncEngine) {
  let prevBoards = useBoardStore.getState().boards
  let prevBoardData = useBoardStore.getState().boardData
  
  const unsubBoard = useBoardStore.subscribe((state) => {
    // 画板列表变化 → 写 manifest
    if (state.boards !== prevBoards) {
      syncEngine.scheduleWriteManifest({ boards: state.boards })
      prevBoards = state.boards
    }
    
    // 画板数据变化 → 写 board 文件
    if (state.boardData !== prevBoardData) {
      for (const boardId in state.boardData) {
        if (state.boardData[boardId] !== prevBoardData[boardId]) {
          const data = state.boardData[boardId]
          syncEngine.scheduleWriteBoard(boardId, {
            version: 2,
            nodes: data.nodes.map(n => ({
              id: n.id, type: n.type === 'card' || n.type === 'section' ? n.type : 'card',
              position: { x: n.position.x, y: n.position.y },
              data: n.data as { cardId?: string; color?: string; variant?: string; collapsed?: boolean; fixedHeight?: boolean; width?: number; height?: number; name?: string },
              width: n.width, height: n.height,
            })),
            edges: data.edges.map(e => ({
              id: e.id, source: e.source, target: e.target,
              type: 'connection',
            })),
            viewport: { x: 0, y: 0, zoom: 1 },
          })
        }
      }
      prevBoardData = state.boardData
    }
  })
  
  return unsubBoard
}

export function subscribeTrashStore(syncEngine: WorkspaceSyncEngine) {
  let prevItems = useTrashStore.getState().items
  
  return useTrashStore.subscribe((state) => {
    // 检查新增
    for (const item of state.items) {
      const prev = prevItems.find(i => i.cardId === item.cardId)
      if (!prev) {
        syncEngine.scheduleWriteTrash({
          id: item.id,
          cardId: item.cardId,
          title: item.title,
          deletedAt: item.deletedAt,
          expiresAt: item.expiresAt,
          content: item.content,
        })
      }
    }
    
    // 检查删除（恢复）
    for (const prev of prevItems) {
      if (!state.items.find(i => i.cardId === prev.cardId)) {
        syncEngine.scheduleDeleteTrashFile(prev.cardId)
      }
    }
    
    prevItems = state.items
  })
}
```

- [ ] **Step 2: 在 App.tsx 中调用订阅**

找到调用 `useWorkspaceLifecycle` 的地方，接收返回的 syncEngineRef 并启动订阅：

```ts
const syncEngineRef = useWorkspaceLifecycle({ setNodes, setEdges, nodesRef })

// 当 syncEngine 就绪后订阅
useEffect(() => {
  const syncEngine = syncEngineRef.current
  if (!syncEngine) return
  
  const unsubs = [
    subscribeCardStore(syncEngine),
    subscribeBoardStore(syncEngine),
    subscribeTrashStore(syncEngine),
  ]
  
  return () => {
    unsubs.forEach(fn => fn())
    syncEngine.stop()
  }
}, [syncEngineRef.current])
```

---

### Task 8: localStorage 数据迁移到文件系统

**Files:**
- Create: `src/utils/migrateFromLocalStorage.ts`

- [ ] **Step 1: 创建迁移文件**

```ts
import { useCardStore } from './cardStore'
import { useBoardStore } from './boardStore'
import { cardFileToGlobalCard, globalCardToCardFile } from './workspace/cardConverter'

/**
 * 迁移 localStorage 中已有的数据到 store
 * 当用户首次切换到文件系统时，将 localStorage 数据灌入 store
 * 后续 syncEngine 会自动写盘
 */
export function migrateFromLocalStorageIfNeeded(): boolean {
  const cardStore = useCardStore.getState()
  
  // 如果 store 已经有数据（从文件加载的），跳过迁移
  if (Object.keys(cardStore.cards).length > 0) return false
  
  let migrated = false
  
  try {
    const stored = localStorage.getItem('hepta-card-store')
    if (stored) {
      const parsed = JSON.parse(stored)
      const cards: Record<string, unknown> = parsed?.state?.cards || {}
      if (Object.keys(cards).length > 0) {
        const globalCards: Record<string, ReturnType<typeof cardFileToGlobalCard>> = {}
        for (const [id, card] of Object.entries(cards)) {
          globalCards[id] = cardFileToGlobalCard(card as Parameters<typeof cardFileToGlobalCard>[0])
        }
        cardStore.importCards(globalCards as Parameters<typeof cardStore.importCards>[0])
        migrated = true
      }
    }
  } catch (e) {
    console.warn('Failed to migrate card store:', e)
  }

  try {
    const stored = localStorage.getItem('hepta-board-store')
    if (stored) {
      const parsed = JSON.parse(stored)
      const boardState = parsed?.state
      if (boardState) {
        const boardStore = useBoardStore.getState()
        if (boardState.boards && boardState.boards.length > 0) {
          boardStore.setBoards(boardState.boards)
        }
        if (boardState.activeBoardId) {
          boardStore.setActiveBoard(boardState.activeBoardId)
        }
        if (boardState.boardData) {
          for (const [id, data] of Object.entries(boardState.boardData)) {
            boardStore.saveBoardData(id, data as Parameters<typeof boardStore.saveBoardData>[1])
          }
        }
        migrated = true
      }
    }
  } catch (e) {
    console.warn('Failed to migrate board store:', e)
  }

  return migrated
}
```

- [ ] **Step 2: 在 useWorkspaceLifecycle 文件加载后调用迁移**

在 Task 6 的启动流程中，第 9 步（切换到当前画板）之后添加：

```ts
// 8.5 迁移 localStorage 数据
migrateFromLocalStorageIfNeeded()
```

---

### Task 9: 文件系统备份

**Files:**
- Modify: `src/utils/backupStore.ts` — 添加文件系统备份

- [ ] **Step 1: 添加文件系统备份函数**

```ts
import { exists, mkdir, readdir, writeFile } from './workspace/fs'

const MAX_FILE_BACKUPS = 10

export async function createFileSystemBackup(workspacePath: string): Promise<string | null> {
  try {
    const backupDir = `${workspacePath}/.backup/${Date.now()}`
    await mkdir(backupDir)
    
    // 复制 cards/ 目录
    const cardsDir = `${workspacePath}/cards`
    if (await exists(cardsDir)) {
      await mkdir(`${backupDir}/cards`)
      const cardFiles = await readdir(cardsDir)
      for (const file of cardFiles) {
        if (!file.endsWith('.json')) continue
        const { readFile: readF } = await import('./workspace/fs')
        const content = await readF(`${cardsDir}/${file}`)
        await writeFile(`${backupDir}/cards/${file}`, content)
      }
    }
    
    // 复制 boards/ 目录
    const boardsDir = `${workspacePath}/boards`
    if (await exists(boardsDir)) {
      await mkdir(`${backupDir}/boards`)
      const boardFiles = await readdir(boardsDir)
      for (const file of boardFiles) {
        if (!file.endsWith('.json')) continue
        const { readFile: readF } = await import('./workspace/fs')
        const content = await readF(`${boardsDir}/${file}`)
        await writeFile(`${backupDir}/boards/${file}`, content)
      }
    }
    
    // 清理旧备份，保留最近 MAX_FILE_BACKUPS 个
    const backupParent = `${workspacePath}/.backup`
    const allBackups = (await readdir(backupParent))
      .filter(name => /^\d+$/.test(name))
      .sort()
    
    while (allBackups.length > MAX_FILE_BACKUPS) {
      const old = allBackups.shift()!
      const { deleteFile } = await import('./workspace/fs')
      const oldDir = `${backupParent}/${old}`
      const oldCards = await readdir(`${oldDir}/cards`).catch(() => [] as string[])
      for (const f of oldCards) await deleteFile(`${oldDir}/cards/${f}`)
      const oldBoards = await readdir(`${oldDir}/boards`).catch(() => [] as string[])
      for (const f of oldBoards) await deleteFile(`${oldDir}/boards/${f}`)
      // Note: rmdir not exposed via IPC - directories remain empty
    }
    
    return backupDir
  } catch (e) {
    console.warn('File system backup failed:', e)
    return null
  }
}
```

- [ ] **Step 2: 在启动流程中触发备份**

在 `useWorkspaceLifecycle.ts` 加载完成后：

```ts
// 10. 自动备份
createFileSystemBackup(workspacePath)
```

注意：错误不应阻塞启动流程，用 `void` 或 `.catch()` 保证不抛出。

---

### Task 10: 端到端验证

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm dev
```

- [ ] **Step 2: 验证首次启动**

1. 确认弹出"选择工作区目录"对话框
2. 选择一个目录
3. 确认应用正常启动，无报错

- [ ] **Step 3: 验证数据持久化**

1. 创建一张新卡片（写入 demo 数据或输入内容）
2. 刷新/重启应用
3. 确认卡片仍然存在

- [ ] **Step 4: 验证文件写入**

打开工作区目录，确认：
- `cards/` 目录包含 `.json` 文件
- `boards/` 目录包含 `_manifest.json` 和画板文件
- `trash/` 目录（若有回收站操作）

- [ ] **Step 5: 验证回收站**

1. 删除一张卡片
2. 确认 `trash/` 目录出现 `.trash.json` 文件
3. 从回收站恢复卡片
4. 确认卡片文件重新出现

- [ ] **Step 6: 验证备份**

确认 `.backup/` 目录已创建且有备份内容。

- [ ] **Step 7: 验证切换画板时保存**

1. 创建多个画板
2. 在画板间切换
3. 刷新应用
4. 确认画板数据正确恢复
