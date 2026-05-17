# 文件系统持久化 — Review 修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复文件系统持久化实现中的 10 个问题（3 严重 / 4 中等 / 3 小）

**Architecture:** 修复订阅时序、数据丢失、并发安全等问题，确保 store 变更正确写入磁盘

**Tech Stack:** Zustand subscribe, Electron IPC, fs/promises

---

## 问题清单

### 🔴 严重 Bug

| # | 文件 | 问题 |
|---|------|------|
| 1 | `ReactFlowCanvas.tsx` + `useWorkspaceLifecycle.ts` | **订阅永远不生效**：`useEffect([], [])` 在挂载时执行，此时 `syncEngineRef.current` 为 null（异步 boot 尚未完成），订阅不会建立，导致所有 store 变更都不会写盘 |
| 2 | `subscribeStores.ts` | **首次真实编辑被跳过**：`subscribeCardStore` 的 `firstCall` 守卫会在订阅后第一次回调时消耗，而 Zustand subscribe 不会立即触发，所以第一次真实用户编辑会被静默跳过 |
| 3 | `useWorkspaceLifecycle.ts` | **切换画板丢失连接线**：`switchToBoard` 保存当前画板时硬编码 `edges: []`，每次切换画板都会丢失当前画板的所有连接线 |

### 🟡 中等问题

| # | 文件 | 问题 |
|---|------|------|
| 4 | `syncEngine.ts` | **flushAll 遍历时删除**：`for...of` 遍历 `pendingWrites` 的同时调用 `delete(key)`，会跳过条目；且 `__DELETE__` 操作被完全跳过 |
| 5 | `syncEngine.ts` | **stop() 不等待异步写入**：`stop()` 是同步方法，`flushAll()` 内部调用异步 `executeWrite` 但不 await，关窗口时数据可能丢失 |
| 6 | `WorkspaceService.ts` | **循环内重复动态导入**：`cleanExpiredTrash` 每次迭代都 `await import(...)`，应提取到循环外部 |
| 7 | `subscribeStores.ts` | **subscribeBoardStore 无防御性守卫**：如果订阅建立与首次回调之间有状态变更，可能产生多余磁盘写入 |

### 🟢 小问题

| # | 文件 | 问题 |
|---|------|------|
| 8 | `cardConverter.ts` | **字段丢失**：`cardFileToGlobalCard` 不映射 `title`、`updatedAt`，导致加载后这些字段为 undefined |
| 9 | `syncEngine.ts` | **onFlush 死代码**：`onFlush` 监听器注册了但从未调用 |
| 10 | `backupStore.ts` | **空目录残留**：删除旧备份时只删文件不删目录 |

---

## 修复任务

### Task 1: 修复订阅时序 + 画板切换 edges 丢失

**Files:**
- Modify: `src/hooks/useWorkspaceLifecycle.ts` — 返回 `{ syncEngineRef, ready }`
- Modify: `src/components/canvas/ReactFlowCanvas.tsx` — 添加 edgesRef、用 `ready` 驱动订阅 effect
- Modify: `src/utils/subscribeStores.ts` — 移除 firstCall 守卫

**问题 1 修复原理：** 用 `useState(false)` 标记 boot 完成状态，boot 完成后 `setReady(true)` 触发重渲染，订阅 useEffect 以 `[ready]` 为依赖重新执行，此时 `syncEngineRef.current` 已赋值。

**问题 2 修复原理：** 移除 `firstCall` 守卫。因为订阅在 boot 完成后才建立，Zustand subscribe 不会立即触发，首次回调就是真实用户操作，不应跳过。

**问题 3 修复原理：** 添加 `edgesRef` 跟踪 edges 变化，`switchToBoard` 保存时使用 `edgesRef.current` 而非 `[]`。

- [ ] **Step 1: 修改 `useWorkspaceLifecycle.ts` — 返回 ready 状态**

在 hook 开头添加 `useState`:
```tsx
import { useEffect, useRef, useCallback, useState } from 'react'
```

在 `syncEngineRef` 声明后添加:
```tsx
const [ready, setReady] = useState(false)
```

在 boot 的 try 块末尾（`switchToBoard` 之后）添加:
```tsx
setReady(true)
```

在 catch 块末尾（demo mode fallback 之后）添加:
```tsx
setReady(true)
```

修改返回值:
```tsx
return { syncEngineRef, ready }
```

- [ ] **Step 2: 修改 `useWorkspaceLifecycle.ts` — 接受 edgesRef 参数**

修改接口:
```tsx
interface UseWorkspaceLifecycleOptions {
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  nodesRef: React.RefObject<Node[]>
  edgesRef: React.RefObject<Edge[]>
}
```

修改 `switchToBoard` 中保存 edges 的代码:
```tsx
if (activeBoardIdRef.current && nodesRef.current) {
  boardStore.saveBoardData(activeBoardIdRef.current, {
    nodes: nodesRef.current.map(n => ({
      id: n.id, type: n.type || 'card',
      position: { ...n.position }, data: { ...n.data },
      width: n.width as number | undefined, height: n.height as number | undefined,
    })),
    edges: edgesRef.current ? edgesRef.current.map(e => ({
      id: e.id, source: e.source, target: e.target,
      type: (e.type || 'connection') as string,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    })) : [],
  })
}
```

修改 hook 签名:
```tsx
export function useWorkspaceLifecycle({ setNodes, setEdges, nodesRef, edgesRef }: UseWorkspaceLifecycleOptions) {
```

- [ ] **Step 3: 修改 `ReactFlowCanvas.tsx` — 添加 edgesRef + 修改订阅逻辑**

添加 edgesRef（在 nodesRef 附近）:
```tsx
const edgesRef = useRef<Edge[]>(edges)

useEffect(() => {
  edgesRef.current = edges
}, [edges])
```

修改 hook 调用:
```tsx
const { syncEngineRef, ready } = useWorkspaceLifecycle({ setNodes, setEdges, nodesRef, edgesRef })
```

修改订阅 useEffect:
```tsx
useEffect(() => {
  if (!ready) return
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
}, [ready])
```

- [ ] **Step 4: 修改 `subscribeStores.ts` — 移除 firstCall**

移除 `subscribeCardStore` 中的 `firstCall` 相关代码:
```tsx
export function subscribeCardStore(syncEngine: WorkspaceSyncEngine) {
  let prevCards = useCardStore.getState().cards

  return useCardStore.subscribe((state) => {
    const cards = state.cards

    for (const id in cards) {
      if (cards[id] !== prevCards[id]) {
        const cardFile = globalCardToCardFile(cards[id])
        syncEngine.scheduleWriteCard(cardFile)
      }
    }

    for (const id in prevCards) {
      if (!(id in cards)) {
        syncEngine.scheduleDeleteCard(id)
      }
    }

    prevCards = cards
  })
}
```

- [ ] **Step 5: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 2: 修复 syncEngine flushAll + stop + 移除 onFlush 死代码

**Files:**
- Modify: `src/utils/workspace/syncEngine.ts`

- [ ] **Step 1: 修复 flushAll — 先收集再执行**

将 `flushAll` 方法替换为:
```tsx
flushAll() {
  const entries = [...this.pendingWrites.entries()]
  for (const [key, { timer }] of entries) {
    clearTimeout(timer)
  }
  this.pendingWrites.clear()

  for (const [key, data] of entries) {
    try {
      const path = key.startsWith('delete:') ? key.slice(7) : key
      if (data === '__DELETE__') {
        // Fire-and-forget async delete
        exists(path).then(exists => {
          if (exists) deleteFile(path)
        }).catch(e => console.warn('SyncEngine flush delete error:', e))
      } else {
        // Fire-and-forget async write
        const tmpPath = path + '.tmp'
        writeFile(tmpPath, data)
          .then(() => rename(tmpPath, path))
          .catch(e => console.warn('SyncEngine flush write error:', e))
      }
    } catch (e) {
      console.warn('SyncEngine flush error:', e)
    }
  }
}
```

- [ ] **Step 2: 修改 stop — 先停止再 flush**

```tsx
stop() {
  this.running = false
  for (const [, { timer }] of this.pendingWrites) {
    clearTimeout(timer)
  }
  this.flushAll()
}
```

注意：flushAll 内部已经 clear 了 pendingWrites，所以 stop 不需要再 clear。调整顺序：先设 running = false，再清 timer，再 flush。

- [ ] **Step 3: 移除 onFlush 死代码**

删除:
```tsx
private onFlushListeners: Listener[] = []

onFlush(listener: Listener) {
  this.onFlushListeners.push(listener)
}
```

同时删除顶部的 `type Listener = () => void`。

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 3: 修复 cleanExpiredTrash 循环内动态导入

**Files:**
- Modify: `src/services/WorkspaceService.ts`

- [ ] **Step 1: 提取 import 到循环外部**

将 `cleanExpiredTrash` 方法中的:
```tsx
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

改为:
```tsx
async cleanExpiredTrash(): Promise<number> {
  const dir = `${this.workspacePath}/trash`
  if (!(await exists(dir))) return 0
  const files = await readdir(dir)
  const { deleteFile: delFile } = await import('../utils/workspace/fs')
  const now = Date.now()
  let cleaned = 0
  for (const file of files) {
    if (!file.endsWith('.trash.json')) continue
    try {
      const item = await readJSON<TrashFile>(`${dir}/${file}`)
      if (item.expiresAt <= now) {
        await delFile(`${dir}/${file}`)
        cleaned++
      }
    } catch {
      // If parsing fails, skip
    }
  }
  return cleaned
}
```

同时修复 `deleteCard` 方法中的同样问题:
```tsx
async deleteCard(cardId: string): Promise<void> {
  const path = `${this.workspacePath}/cards/${cardId}.json`
  if (await exists(path)) {
    const { deleteFile: delFile } = await import('../utils/workspace/fs')
    await delFile(path)
  }
}
```

或者更简洁地，将 `deleteFile` 加到文件顶部的 import:
```tsx
import { readJSON, writeJSON, exists, readdir, mkdir, deleteFile } from '../utils/workspace/fs'
```

然后直接使用 `deleteFile`，不再需要动态导入。

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 4: 修复 cardConverter 字段丢失

**Files:**
- Modify: `src/utils/workspace/cardConverter.ts`

- [ ] **Step 1: 补充 cardFileToGlobalCard 的字段映射**

将:
```tsx
export function cardFileToGlobalCard(file: CardFile): GlobalCard {
  return {
    id: file.id,
    content: file.content,
    color: file.color as GlobalCard['color'],
    variant: file.variant as GlobalCard['variant'],
    createdAt: file.createdAt,
    enforceInitialHeading: file.enforceInitialHeading,
    fixedHeight: file.fixedHeight,
    collapsed: file.collapsed,
  }
}
```

改为:
```tsx
export function cardFileToGlobalCard(file: CardFile): GlobalCard {
  return {
    id: file.id,
    content: file.content,
    color: file.color as GlobalCard['color'],
    variant: file.variant as GlobalCard['variant'],
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    title: file.title,
    enforceInitialHeading: file.enforceInitialHeading,
    fixedHeight: file.fixedHeight,
    collapsed: file.collapsed,
  }
}
```

- [ ] **Step 2: 补充 globalCardToCardFile 的 updatedAt 映射**

将:
```tsx
export function globalCardToCardFile(card: GlobalCard): CardFile {
  return {
    id: card.id,
    title: extractTitleFromContent(card.content),
    color: card.color,
    variant: card.variant,
    createdAt: card.createdAt,
    content: card.content,
    enforceInitialHeading: card.enforceInitialHeading,
    fixedHeight: card.fixedHeight,
    collapsed: card.collapsed,
  }
}
```

改为:
```tsx
export function globalCardToCardFile(card: GlobalCard): CardFile {
  return {
    id: card.id,
    title: card.title || extractTitleFromContent(card.content),
    color: card.color,
    variant: card.variant,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    content: card.content,
    enforceInitialHeading: card.enforceInitialHeading,
    fixedHeight: card.fixedHeight,
    collapsed: card.collapsed,
  }
}
```

这样 `title` 优先使用 card 上已有的值（来自磁盘加载），只在没有时才从 content 提取。`updatedAt` 也会正确持久化。

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 5: 修复 backupStore 空目录残留

**Files:**
- Modify: `electron/main.ts` — 添加 `fs:rmdir` IPC handler
- Modify: `electron/preload.ts` — 暴露 `rmdir`
- Modify: `src/utils/workspace/fs.ts` — 添加 `rmdir` 到 FSAdapter 接口和封装函数
- Modify: `src/utils/workspace/index.ts` — 导出 `rmdir`
- Modify: `src/utils/backupStore.ts` — 删除文件后删目录

- [ ] **Step 1: 在 `electron/main.ts` 添加 rmdir handler**

在 `fs:rename` handler 之后添加:
```tsx
ipcMain.handle('fs:rmdir', async (_event, path: string) => {
  const fs = await import('fs/promises')
  await fs.rm(path, { recursive: true, force: true })
})
```

使用 `fs.rm` 而非 `fs.rmdir`，因为 `rmdir` 不支持非空目录，`rm` 更健壮。

- [ ] **Step 2: 在 `electron/preload.ts` 暴露 rmdir**

在 `fs` 对象中添加:
```tsx
rmdir: (path: string) => ipcRenderer.invoke('fs:rmdir', path),
```

- [ ] **Step 3: 在 `src/utils/workspace/fs.ts` 添加 rmdir**

FSAdapter 接口添加:
```tsx
rmdir(path: string): Promise<void>
```

封装函数:
```tsx
export async function rmdir(path: string): Promise<void> {
  await getFSAdapter().rmdir(path)
}
```

- [ ] **Step 4: 在 `src/utils/workspace/index.ts` 导出 rmdir**

```tsx
export { setFSAdapter, getFSAdapter, readFile, writeFile, deleteFile, readdir, mkdir, stat, exists, rename, rmdir, readJSON, writeJSON } from './fs'
```

- [ ] **Step 5: 修改 `src/utils/backupStore.ts` 的旧备份清理**

在 `createFileSystemBackup` 的旧备份清理循环中，文件删除后添加目录删除:

```tsx
while (allBackups.length > MAX_FILE_BACKUPS) {
  const old = allBackups.shift()!
  const oldDir = `${backupParent}/${old}`
  const oldCardsDir = `${oldDir}/cards`
  if (await exists(oldCardsDir)) {
    const oldCardFiles = await readdir(oldCardsDir)
    for (const f of oldCardFiles) await delF(`${oldCardsDir}/${f}`)
    await rmdir(oldCardsDir).catch(() => {})
  }
  const oldBoardsDir = `${oldDir}/boards`
  if (await exists(oldBoardsDir)) {
    const oldBoardFiles = await readdir(oldBoardsDir)
    for (const f of oldBoardFiles) await delF(`${oldBoardsDir}/${f}`)
    await rmdir(oldBoardsDir).catch(() => {})
  }
  await rmdir(oldDir).catch(() => {})
}
```

在文件顶部的动态 import 中添加 `rmdir`:
```tsx
const { mkdir, exists, readdir, writeFile: writeF, readFile: readF, deleteFile: delF, rmdir } = await import('./workspace/fs')
```

- [ ] **Step 6: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

## 验证清单

所有任务完成后:
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `pnpm dev` 启动无报错
- [ ] 打开 DevTools Console 无 warn/error
- [ ] 创建卡片 → 关闭重开 → 卡片仍在
- [ ] 创建连接线 → 切换画板 → 切回 → 连接线仍在
- [ ] 删除卡片 → 回收站中有记录且时间戳正确
