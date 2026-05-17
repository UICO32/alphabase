# 文件系统持久化设计

## 概述

将当前依赖 localStorage 的数据持久化方案，**完全迁移到文件系统**。数据以 JSON 文件形式存储在用户指定的工作区目录中，从而实现跨会话、跨浏览器（Electron 换环境不丢数据）的持久存储。

## 背景

当前状态：
- `cardStore`、`boardStore`、`libraryStore` 使用 zustand `persist` 中间件 → 存到 `localStorage`
- `trashStore`、`workspaceStore` 未持久化
- `WorkspaceSyncEngine` 已实现写入调度但未订阅 store 变更
- `WorkspaceService` 已实现文件读写但未被调用
- `loadCardsFromDB()` 是空操作
- 启动时使用硬编码演示数据

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                         启动流程                             │
│                                                             │
│  localStorage: lastWorkspacePath  ──→ 指向磁盘目录            │
│                                          ↓                   │
│  WorkspaceService.initWorkspace(path)                       │
│    ├─ 读取 boards/_manifest.json    ──→ boardStore.boards    │
│    ├─ 读取 boards/<id>.json         ──→ boardStore.boardData │
│    ├─ 读取 cards/*.json              ──→ cardStore.cards     │
│    ├─ 读取 trash/*.trash.json        ──→ trashStore.items    │
│    └─ 读取 settings.json             ──→ workspaceStore      │
│                                          ↓                   │
│  isLoaded = true                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        运行写入                              │
│                                                             │
│  cardStore.cards 变化 ──subscribe──→ WorkspaceSyncEngine     │
│  boardStore 变化     ──subscribe──→ WorkspaceSyncEngine     │
│  trashStore 变化     ──subscribe──→ WorkspaceSyncEngine     │
│                                          ↓                   │
│  scheduleWriteCard(id)       debounce 500ms → cards/<id>.json│
│  scheduleWriteBoard(id)      debounce 600ms → boards/<id>.json
│  scheduleWriteManifest()     debounce 300ms → _manifest.json │
│  scheduleWriteTrash(id)      debounce 500ms → trash/<id>.json│
│                                          ↓                   │
│  Electron IPC → fs.promises 原子写入（先写.tmp再rename）    │
└─────────────────────────────────────────────────────────────┘
```

## 详细设计

### 1. 工作区目录管理

- 工作区路径仅存一个字符串到 `localStorage`（key: `lastWorkspacePath`），不存任何数据
- 启动时读取该路径：
  - 路径存在且目录有效 → 自动加载
  - 路径不存在或目录无效 → 弹出系统目录选择对话框（`electronAPI.dialog.openDirectory`），用户选择后存入 `lastWorkspacePath`
- 用户可通过菜单"切换工作区"手动选择新的路径

### 2. 启动数据加载

修改 `useWorkspaceLifecycle.ts`：

```ts
async function loadWorkspace(path: string) {
  const service = WorkspaceService.getInstance()
  await service.initWorkspace(path)

  // 加载画板清单
  const manifest = await service.loadManifest()
  boardStore.getState().setBoards(manifest.boards)

  // 逐个加载画板快照
  for (const board of manifest.boards) {
    const snapshot = await service.loadBoard(board.id)
    boardStore.getState().setBoardData(board.id, snapshot)
  }

  // 加载所有卡片
  const cards = await service.loadAllCards()
  cardStore.getState().importCards(cards)

  // 加载回收站
  const trashItems = await service.loadAllTrash()
  trashStore.getState().setItems(trashItems)

  // 清理过期回收站
  await service.cleanExpiredTrash()

  // 初始化 syncEngine
  syncEngine.init(path)

  // 订阅 store 变更
  subscribeCardStore(syncEngine)
  subscribeBoardStore(syncEngine)
  subscribeTrashStore(syncEngine)

  isLoaded = true
}
```

### 3. Store 变更订阅

`cardStore.subscribe` → `syncEngine.scheduleWriteCard(id, cardFile)`：

```ts
// 使用 zustand subscribe + shallow 比较避免不必要的写入
const unsubCards = useCardStore.subscribe(
  (state) => state.cards,
  (cards, prevCards) => {
    for (const id in cards) {
      if (cards[id] !== prevCards[id]) {
        const cardFile = globalCardToCardFile(cards[id])
        syncEngine.scheduleWriteCard(id, cardFile)
      }
    }
    // 检查删除的卡片
    for (const id in prevCards) {
      if (!(id in cards)) {
        syncEngine.scheduleDeleteCard(id)
      }
    }
  },
  { equalityFn: shallow }
)
```

`boardStore` 和 `trashStore` 类似。

### 4. 原子写入

修改 `syncEngine` 的写入方法，防止崩溃导致文件损坏：

```ts
async writeFileAtomic(filePath: string, data: string) {
  const tmpPath = filePath + '.tmp'
  await fs.writeFile(tmpPath, data, 'utf-8')
  await fs.rename(tmpPath, filePath)
}
```

### 5. 移除 localStorage persist

- `cardStore`：移除 `persist` 中间件
- `boardStore`：移除 `persist` 中间件
- `libraryStore`：UI 偏好也走文件系统（写入 `settings.json`），移除 `persist` 中间件
- `workspaceStore`：启用文件系统持久化（`settings.json`）

### 6. 回收站持久化

- `trashStore` 增加 `persisted: true` 和同步到文件系统的逻辑
- 删除卡片时：`syncEngine.scheduleWriteTrash(id, trashData)` → `trash/<id>.trash.json`
- 恢复卡片时：`syncEngine.scheduleDeleteTrashFile(id)`
- 启动时自动清理超过 30 天的回收站项目
- 回收站文件格式兼容旧项目

### 7. 自动备份

使用文件系统备份，替代现有的 IndexedDB 备份：

```ts
async function createBackup(workspacePath: string) {
  const backupDir = join(workspacePath, '.backup', Date.now().toString())
  await mkdir(backupDir, { recursive: true })
  // 复制 cards/ 和 boards/ 目录
  await copyDir(join(workspacePath, 'cards'), join(backupDir, 'cards'))
  await copyDir(join(workspacePath, 'boards'), join(backupDir, 'boards'))
  // 保留最近 10 个备份，删除旧的
  await pruneBackups(join(workspacePath, '.backup'), 10)
}
```

触发时机：
- 启动加载完成后自动创建一次
- 后续每次 `isLoaded = true` 重新加载时创建（即用户切换工作区时）

### 8. 迁移已有数据

对于当前 localStorage 中已有的数据（用户已在使用的卡片），在首次切换到文件系统时迁移：

```ts
async function migrateFromLocalStorage(workspacePath: string) {
  const localCards = localStorage.getItem('hepta-card-store')
  if (localCards) {
    const parsed = JSON.parse(localCards)
    const cards = parsed.state.cards
    for (const [id, card] of Object.entries(cards)) {
      const cardFile = globalCardToCardFile(card)
      await fs.writeFile(join(workspacePath, 'cards', `${id}.json`), JSON.stringify(cardFile))
    }
    localStorage.removeItem('hepta-card-store')
  }
  // 同样迁移 board 和 library
}
```

## 受影响的文件

| 文件 | 改动 |
|------|------|
| `src/hooks/useWorkspaceLifecycle.ts` | 重写启动流程，串联加载 |
| `src/utils/cardStore.ts` | 移除 `persist` 中间件，实现 `loadCardsFromDB` |
| `src/utils/boardStore.ts` | 移除 `persist` 中间件 |
| `src/utils/libraryStore.ts` | 移除 `persist` 中间件，改为 `settings.json` |
| `src/utils/trashStore.ts` | 增加持久化支持 |
| `src/utils/workspace/syncEngine.ts` | 添加 store 订阅、原子写入、trash 支持 |
| `src/utils/workspace/fs.ts` | 添加原子写入方法 |
| `src/services/WorkspaceService.ts` | 添加 `loadAllTrash`、`cleanExpiredTrash` |
| `src/utils/workspace/types.ts` | 可能需扩展 trash 类型 |
| `electron/main.ts` | 可能需添加 `rename` IPC 处理 |

## 不做的

- 不保留 localStorage 作为缓存（双写双读增加复杂度和不一致风险）
- 不保留 IndexedDB 备份模块（改用文件系统 `.backup/`）
- 不添加冲突检测（单用户桌面应用不需要）
- 不添加实时同步（非协同应用）
