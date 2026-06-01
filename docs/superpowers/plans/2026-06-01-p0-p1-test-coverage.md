# P0/P1 测试补充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为项目核心模块补充单元测试，覆盖 Store CRUD、syncEngine 持久化写入、纯函数边界值。

**Architecture:** Store 测试直接测 Zustand 状态转换（mock flushActiveSyncEngine），syncEngine 测试 mock fs 模块验证写入路径和原子性，纯函数测输入输出无需 mock。

**Tech Stack:** Vitest + jsdom（项目已有配置）

---

## File Structure

| 文件 | 职责 |
|------|------|
| `src/stores/cardStore.test.ts` | 卡片 CRUD + undo/redo 测试 |
| `src/stores/boardStore.test.ts` | 画板 CRUD + boardData 测试 |
| `src/stores/trashStore.test.ts` | 回收站生命周期测试 |
| `src/sync/syncEngine.test.ts` | 覆写现有文件，补全测试 |
| `src/utils/geometry.test.ts` | 坐标计算纯函数测试 |
| `src/utils/cardStyles.test.ts` | 颜色映射纯函数测试 |
| `src/utils/fileUtils.test.ts` | ID 生成格式测试 |

---

### Task 1: cardStore.test.ts

**Files:**
- Create: `src/stores/cardStore.test.ts`
- Reference: `src/stores/cardStore.ts`

- [ ] **Step 1: 创建测试文件，mock 依赖，写 addCard 测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCardStore } from './cardStore'
import type { GlobalCard } from './cardStore'

// mock flushActiveSyncEngine 避免真实文件写入
vi.mock('../sync/syncEngineRef', () => ({
  flushActiveSyncEngine: vi.fn(),
}))

// mock renderBlocksToHTML 避免依赖 BlockNote
vi.mock('../converters/renderBlocks', () => ({
  renderBlocksToHTML: vi.fn(() => '<p>mock</p>'),
}))

function makeCard(overrides: Partial<GlobalCard> = {}): GlobalCard {
  return {
    id: 'card-1',
    content: '[]',
    color: 'white',
    createdAt: 1000,
    ...overrides,
  }
}

describe('CardStore', () => {
  beforeEach(() => {
    // Zustand store 重置：用内部 setState 回到初始状态
    const store = useCardStore.getState()
    useCardStore.setState({
      cards: {},
      isLoaded: false,
      cardHistory: {},
      isUndoingContent: {},
    })
  })

  it('添加卡片后应能在 cards 中找到', () => {
    const card = makeCard()
    useCardStore.getState().addCard(card)
    expect(useCardStore.getState().cards['card-1']).toEqual(card)
  })

  it('添加卡片应调用 flushActiveSyncEngine', () => {
    const { flushActiveSyncEngine } = require('../sync/syncEngineRef')
    useCardStore.getState().addCard(makeCard())
    expect(flushActiveSyncEngine).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认通过**

Run: `pnpm test:unit -- src/stores/cardStore.test.ts`
Expected: 2 tests PASS

- [ ] **Step 3: 补充 updateCard 测试**

在 `describe('CardStore')` 内追加：

```typescript
  describe('updateCard', () => {
    it('应更新指定属性并设置 updatedAt', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().updateCard('card-1', { title: '新标题' })
      const card = useCardStore.getState().cards['card-1']
      expect(card.title).toBe('新标题')
      expect(card.updatedAt).toBeDefined()
    })

    it('更新 content 时应清空 previewHTML', () => {
      useCardStore.getState().addCard(makeCard({ previewHTML: '<p>old</p>' }))
      useCardStore.getState().updateCard('card-1', { content: '[new]' })
      expect(useCardStore.getState().cards['card-1'].previewHTML).toBeUndefined()
    })

    it('更新非 content 属性时不应清空 previewHTML', () => {
      useCardStore.getState().addCard(makeCard({ previewHTML: '<p>old</p>' }))
      useCardStore.getState().updateCard('card-1', { title: '新标题' })
      expect(useCardStore.getState().cards['card-1'].previewHTML).toBe('<p>old</p>')
    })

    it('更新不存在的卡片应返回原状态', () => {
      const before = useCardStore.getState().cards
      useCardStore.getState().updateCard('nonexistent', { title: 'x' })
      expect(useCardStore.getState().cards).toEqual(before)
    })
  })
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test:unit -- src/stores/cardStore.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: 补充 delete/softDelete/restore 测试**

```typescript
  describe('deleteCard', () => {
    it('硬删除后卡片不存在', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().deleteCard('card-1')
      expect(useCardStore.getState().cards['card-1']).toBeUndefined()
    })
  })

  describe('softDeleteCard', () => {
    it('软删除后卡片仍在，deletedAt 有值', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().softDeleteCard('card-1')
      const card = useCardStore.getState().cards['card-1']
      expect(card).toBeDefined()
      expect(card.deletedAt).toBeDefined()
    })

    it('软删除不存在的卡片不应报错', () => {
      const before = useCardStore.getState().cards
      useCardStore.getState().softDeleteCard('nonexistent')
      expect(useCardStore.getState().cards).toEqual(before)
    })
  })

  describe('restoreCard', () => {
    it('恢复后 deletedAt 被移除', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().softDeleteCard('card-1')
      useCardStore.getState().restoreCard('card-1')
      expect(useCardStore.getState().cards['card-1'].deletedAt).toBeUndefined()
    })

    it('恢复不存在的卡片不应报错', () => {
      const before = useCardStore.getState().cards
      useCardStore.getState().restoreCard('nonexistent')
      expect(useCardStore.getState().cards).toEqual(before)
    })
  })
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm test:unit -- src/stores/cardStore.test.ts`
Expected: 9 tests PASS

- [ ] **Step 7: 补充 importCards / loadCardsFromDB / undo/redo 测试**

```typescript
  describe('importCards', () => {
    it('应合并到现有 cards', () => {
      useCardStore.getState().addCard(makeCard({ id: 'a' }))
      useCardStore.getState().importCards({
        b: makeCard({ id: 'b' }),
      })
      expect(Object.keys(useCardStore.getState().cards)).toContain('a')
      expect(Object.keys(useCardStore.getState().cards)).toContain('b')
    })
  })

  describe('loadCardsFromDB', () => {
    it('应设置 isLoaded=true', async () => {
      await useCardStore.getState().loadCardsFromDB()
      expect(useCardStore.getState().isLoaded).toBe(true)
    })

    it('传入 cards 时应覆盖', async () => {
      const cards = { x: makeCard({ id: 'x' }) }
      await useCardStore.getState().loadCardsFromDB(cards)
      expect(useCardStore.getState().cards['x']).toBeDefined()
    })

    it('已加载后再次调用不应覆盖', async () => {
      const first = { x: makeCard({ id: 'x' }) }
      await useCardStore.getState().loadCardsFromDB(first)
      const second = { y: makeCard({ id: 'y' }) }
      await useCardStore.getState().loadCardsFromDB(second)
      expect(useCardStore.getState().cards['y']).toBeUndefined()
    })
  })

  describe('undo/redo', () => {
    it('undo 应回退到上一个内容快照', () => {
      useCardStore.getState().addCard(makeCard({ content: 'v1' }))
      useCardStore.getState().recordCardContentSnapshot('card-1')
      useCardStore.getState().updateCard('card-1', { content: 'v2' })
      useCardStore.getState().recordCardContentSnapshot('card-1')
      const result = useCardStore.getState().undoCardContent('card-1')
      expect(result).toBe('v1')
    })

    it('redo 应前进到下一个内容快照', () => {
      useCardStore.getState().addCard(makeCard({ content: 'v1' }))
      useCardStore.getState().recordCardContentSnapshot('card-1')
      useCardStore.getState().updateCard('card-1', { content: 'v2' })
      useCardStore.getState().recordCardContentSnapshot('card-1')
      useCardStore.getState().undoCardContent('card-1')
      const result = useCardStore.getState().redoCardContent('card-1')
      expect(result).toBe('v2')
    })

    it('无历史时 undo 应返回 null', () => {
      useCardStore.getState().addCard(makeCard())
      expect(useCardStore.getState().undoCardContent('card-1')).toBeNull()
    })

    it('clearCardHistory 应清除指定卡片历史', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().recordCardContentSnapshot('card-1')
      useCardStore.getState().clearCardHistory('card-1')
      expect(useCardStore.getState().cardHistory['card-1']).toBeUndefined()
    })

    it('clearCardHistory 无参数应清除全部历史', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().recordCardContentSnapshot('card-1')
      useCardStore.getState().clearCardHistory()
      expect(Object.keys(useCardStore.getState().cardHistory)).toHaveLength(0)
    })
  })
```

- [ ] **Step 8: 运行全部 cardStore 测试**

Run: `pnpm test:unit -- src/stores/cardStore.test.ts`
Expected: 17 tests PASS

- [ ] **Step 9: 提交**

```bash
git add src/stores/cardStore.test.ts
git commit -m "test(stores): add cardStore unit tests"
```

---

### Task 2: boardStore.test.ts

**Files:**
- Create: `src/stores/boardStore.test.ts`
- Reference: `src/stores/boardStore.ts`

- [ ] **Step 1: 创建完整测试文件**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useBoardStore } from './boardStore'
import type { BoardMeta } from '../utils/workspace/types'

vi.mock('../sync/syncEngineRef', () => ({
  flushActiveSyncEngine: vi.fn(),
}))

function makeBoard(overrides: Partial<BoardMeta> = {}): BoardMeta {
  return {
    id: 'board-1',
    name: '测试画板',
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  }
}

describe('BoardStore', () => {
  beforeEach(() => {
    useBoardStore.setState({
      boards: [],
      activeBoardId: null,
      isLoaded: false,
      boardData: {},
    })
  })

  describe('setBoards', () => {
    it('应设置 boards 并标记 isLoaded', () => {
      const boards = [makeBoard()]
      useBoardStore.getState().setBoards(boards)
      expect(useBoardStore.getState().boards).toEqual(boards)
      expect(useBoardStore.getState().isLoaded).toBe(true)
    })
  })

  describe('addBoard', () => {
    it('应追加到 boards 数组', () => {
      useBoardStore.getState().setBoards([makeBoard({ id: 'b1' })])
      useBoardStore.getState().addBoard(makeBoard({ id: 'b2' }))
      expect(useBoardStore.getState().boards).toHaveLength(2)
    })

    it('应调用 flushActiveSyncEngine', () => {
      const { flushActiveSyncEngine } = require('../sync/syncEngineRef')
      useBoardStore.getState().addBoard(makeBoard())
      expect(flushActiveSyncEngine).toHaveBeenCalled()
    })
  })

  describe('updateBoard', () => {
    it('应更新指定画板属性', () => {
      useBoardStore.getState().setBoards([makeBoard()])
      useBoardStore.getState().updateBoard('board-1', { name: '新名称' })
      expect(useBoardStore.getState().boards[0].name).toBe('新名称')
    })

    it('不应影响其他画板', () => {
      useBoardStore.getState().setBoards([
        makeBoard({ id: 'b1', name: 'A' }),
        makeBoard({ id: 'b2', name: 'B' }),
      ])
      useBoardStore.getState().updateBoard('b1', { name: 'A+' })
      expect(useBoardStore.getState().boards[1].name).toBe('B')
    })
  })

  describe('deleteBoard', () => {
    it('应从 boards 移除', () => {
      useBoardStore.getState().setBoards([makeBoard()])
      useBoardStore.getState().deleteBoard('board-1')
      expect(useBoardStore.getState().boards).toHaveLength(0)
    })

    it('应清除对应 boardData', () => {
      useBoardStore.getState().setBoards([makeBoard()])
      useBoardStore.getState().saveBoardData('board-1', { nodes: [], edges: [] })
      useBoardStore.getState().deleteBoard('board-1')
      expect(useBoardStore.getState().boardData['board-1']).toBeUndefined()
    })

    it('删除当前活跃画板应重置 activeBoardId', () => {
      useBoardStore.getState().setBoards([makeBoard()])
      useBoardStore.getState().setActiveBoard('board-1')
      useBoardStore.getState().deleteBoard('board-1')
      expect(useBoardStore.getState().activeBoardId).toBeNull()
    })

    it('删除非活跃画板不应影响 activeBoardId', () => {
      useBoardStore.getState().setBoards([
        makeBoard({ id: 'b1' }),
        makeBoard({ id: 'b2' }),
      ])
      useBoardStore.getState().setActiveBoard('b1')
      useBoardStore.getState().deleteBoard('b2')
      expect(useBoardStore.getState().activeBoardId).toBe('b1')
    })
  })

  describe('setActiveBoard', () => {
    it('应设置 activeBoardId', () => {
      useBoardStore.getState().setActiveBoard('board-1')
      expect(useBoardStore.getState().activeBoardId).toBe('board-1')
    })

    it('传 null 应重置', () => {
      useBoardStore.getState().setActiveBoard('board-1')
      useBoardStore.getState().setActiveBoard(null)
      expect(useBoardStore.getState().activeBoardId).toBeNull()
    })
  })

  describe('boardData', () => {
    it('saveBoardData + getBoardData 应存取一致', () => {
      const data = { nodes: [{ id: 'n1', type: 'card', position: { x: 0, y: 0 }, data: {} }], edges: [] }
      useBoardStore.getState().saveBoardData('board-1', data)
      expect(useBoardStore.getState().getBoardData('board-1')).toEqual(data)
    })

    it('getBoardData 不存在时应返回 undefined', () => {
      expect(useBoardStore.getState().getBoardData('nonexistent')).toBeUndefined()
    })
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `pnpm test:unit -- src/stores/boardStore.test.ts`
Expected: 12 tests PASS

- [ ] **Step 3: 提交**

```bash
git add src/stores/boardStore.test.ts
git commit -m "test(stores): add boardStore unit tests"
```

---

### Task 3: trashStore.test.ts

**Files:**
- Create: `src/stores/trashStore.test.ts`
- Reference: `src/stores/trashStore.ts`

- [ ] **Step 1: 创建完整测试文件**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useTrashStore } from './trashStore'
import type { TrashItem } from './trashStore'

const TRASH_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000

function makeTrashItem(overrides: Partial<TrashItem> = {}): Omit<TrashItem, 'deletedAt' | 'expiresAt'> {
  return {
    id: 'trash-1',
    cardId: 'card-1',
    title: '测试卡片',
    content: '[]',
    color: 'white',
    createdAt: 1000,
    ...overrides,
  }
}

describe('TrashStore', () => {
  beforeEach(() => {
    useTrashStore.setState({ items: [] })
  })

  describe('addItem', () => {
    it('应自动填充 deletedAt 和 expiresAt', () => {
      const before = Date.now()
      useTrashStore.getState().addItem(makeTrashItem())
      const item = useTrashStore.getState().items[0]
      expect(item.deletedAt).toBeGreaterThanOrEqual(before)
      expect(item.expiresAt).toBe(item.deletedAt + TRASH_EXPIRY_MS)
    })

    it('应追加到 items 数组', () => {
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'c1' }))
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'c2' }))
      expect(useTrashStore.getState().items).toHaveLength(2)
    })
  })

  describe('removeItem', () => {
    it('应从 items 中移除指定卡片', () => {
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'c1' }))
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'c2' }))
      useTrashStore.getState().removeItem('c1')
      expect(useTrashStore.getState().items).toHaveLength(1)
      expect(useTrashStore.getState().items[0].cardId).toBe('c2')
    })

    it('移除不存在的卡片不应报错', () => {
      useTrashStore.getState().addItem(makeTrashItem())
      useTrashStore.getState().removeItem('nonexistent')
      expect(useTrashStore.getState().items).toHaveLength(1)
    })
  })

  describe('restoreItem', () => {
    it('应返回 item 并从 items 中移除', () => {
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'c1' }))
      const item = useTrashStore.getState().restoreItem('c1')
      expect(item).toBeDefined()
      expect(item!.cardId).toBe('c1')
      expect(useTrashStore.getState().items).toHaveLength(0)
    })

    it('恢复不存在的卡片应返回 undefined', () => {
      const item = useTrashStore.getState().restoreItem('nonexistent')
      expect(item).toBeUndefined()
    })
  })

  describe('clearExpired', () => {
    it('应清除过期项', () => {
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'expired' }))
      // 手动设置过期时间在过去
      const items = useTrashStore.getState().items
      items[0].expiresAt = Date.now() - 1000
      useTrashStore.setState({ items: [...items] })

      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'valid' }))
      useTrashStore.getState().clearExpired()
      expect(useTrashStore.getState().items).toHaveLength(1)
      expect(useTrashStore.getState().items[0].cardId).toBe('valid')
    })

    it('未过期项应保留', () => {
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'valid' }))
      useTrashStore.getState().clearExpired()
      expect(useTrashStore.getState().items).toHaveLength(1)
    })
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `pnpm test:unit -- src/stores/trashStore.test.ts`
Expected: 8 tests PASS

- [ ] **Step 3: 提交**

```bash
git add src/stores/trashStore.test.ts
git commit -m "test(stores): add trashStore unit tests"
```

---

### Task 4: syncEngine.test.ts（补全）

**Files:**
- Overwrite: `src/sync/syncEngine.test.ts`
- Reference: `src/sync/syncEngine.ts`

- [ ] **Step 1: 覆写完整测试文件**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WorkspaceSyncEngine } from './syncEngine'

const mockWriteFile = vi.fn().mockResolvedValue(undefined)
const mockDeleteFile = vi.fn().mockResolvedValue(undefined)
const mockExists = vi.fn().mockResolvedValue(true)
const mockMkdir = vi.fn().mockResolvedValue(undefined)
const mockRename = vi.fn().mockResolvedValue(undefined)

vi.mock('../utils/workspace/fs', () => ({
  writeFile: mockWriteFile,
  deleteFile: mockDeleteFile,
  exists: mockExists,
  mkdir: mockMkdir,
  rename: mockRename,
}))

vi.mock('../stores/eventBus', () => ({
  useEventBus: () => ({
    getState: () => ({ emit: vi.fn() }),
  }),
}))

describe('WorkspaceSyncEngine', () => {
  let engine: WorkspaceSyncEngine

  beforeEach(async () => {
    vi.clearAllMocks()
    engine = new WorkspaceSyncEngine()
    await engine.init('/test-workspace')
  })

  afterEach(async () => {
    await engine.stop()
  })

  describe('scheduleWriteCard', () => {
    it('防抖后应调用 writeFile + rename（原子写入）', async () => {
      engine.scheduleWriteCard({
        id: 'card-1',
        title: 'Test',
        color: 'white',
        content: '[]',
        createdAt: 1000,
      }, 100)

      // 等待防抖
      await new Promise(r => setTimeout(r, 300))

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test-workspace/cards/card-1.json.tmp',
        expect.any(String),
      )
      expect(mockRename).toHaveBeenCalledWith(
        '/test-workspace/cards/card-1.json.tmp',
        '/test-workspace/cards/card-1.json',
      )
    })

    it('重复 scheduleWrite 应合并（后者覆盖）', async () => {
      engine.scheduleWriteCard({
        id: 'card-1', title: 'v1', color: 'white', content: '[]', createdAt: 1000,
      }, 100)
      engine.scheduleWriteCard({
        id: 'card-1', title: 'v2', color: 'white', content: '[]', createdAt: 1000,
      }, 100)

      await new Promise(r => setTimeout(r, 300))

      // 应只写入一次（最后一次）
      const writeCalls = mockWriteFile.mock.calls.filter(
        (c: string[]) => c[0].includes('card-1.json.tmp'),
      )
      expect(writeCalls.length).toBe(1)
      expect(JSON.parse(writeCalls[0][1]).title).toBe('v2')
    })
  })

  describe('scheduleDeleteCard', () => {
    it('防抖后应调用 deleteFile', async () => {
      engine.scheduleDeleteCard('card-1')

      await new Promise(r => setTimeout(r, 700))

      expect(mockDeleteFile).toHaveBeenCalledWith(
        '/test-workspace/cards/card-1.json',
      )
    })
  })

  describe('拖拽抑制', () => {
    it('isDragging 时 board 不应写入', async () => {
      engine.setDragging(true)
      engine.scheduleWriteBoard('board-1', {
        version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 },
      })

      await new Promise(r => setTimeout(r, 100))

      const boardWrites = mockWriteFile.mock.calls.filter(
        (c: string[]) => c[0].includes('board-1'),
      )
      expect(boardWrites.length).toBe(0)
    })

    it('isDragging 时 card 仍应写入', async () => {
      engine.setDragging(true)
      engine.scheduleWriteCard({
        id: 'card-1', title: 'Test', color: 'white', content: '[]', createdAt: 1000,
      }, 100)

      await new Promise(r => setTimeout(r, 300))

      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('拖拽结束后 board 应恢复写入', async () => {
      engine.setDragging(true)
      engine.setDragging(false)
      engine.scheduleWriteBoard('board-1', {
        version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 },
      }, 100)

      await new Promise(r => setTimeout(r, 300))

      const boardWrites = mockWriteFile.mock.calls.filter(
        (c: string[]) => c[0].includes('board-1'),
      )
      expect(boardWrites.length).toBe(1)
    })
  })

  describe('flushAll', () => {
    it('应立即写入所有 pending', async () => {
      engine.scheduleWriteCard({
        id: 'c1', title: 'A', color: 'white', content: '[]', createdAt: 1000,
      }, 5000)
      engine.scheduleWriteCard({
        id: 'c2', title: 'B', color: 'white', content: '[]', createdAt: 1000,
      }, 5000)

      await engine.flushAll()

      expect(mockWriteFile).toHaveBeenCalledTimes(2)
    })
  })

  describe('stop', () => {
    it('应调用 flushAll 并停止运行', async () => {
      engine.scheduleWriteCard({
        id: 'c1', title: 'A', color: 'white', content: '[]', createdAt: 1000,
      }, 5000)

      await engine.stop()

      expect(mockWriteFile).toHaveBeenCalled()
      expect(engine.isRunning()).toBe(false)
    })
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `pnpm test:unit -- src/sync/syncEngine.test.ts`
Expected: 8 tests PASS

- [ ] **Step 3: 提交**

```bash
git add src/sync/syncEngine.test.ts
git commit -m "test(sync): expand syncEngine tests with write/delete/flush coverage"
```

---

### Task 5: geometry.test.ts

**Files:**
- Create: `src/utils/geometry.test.ts`
- Reference: `src/utils/geometry.ts`

- [ ] **Step 1: 创建完整测试文件**

```typescript
import { describe, it, expect } from 'vitest'
import { edgePointOnRect, getBestHandles, positionToHandleId } from './geometry'
import { Position } from '@xyflow/react'

describe('edgePointOnRect', () => {
  const rect = { x: 0, y: 0, w: 100, h: 100 }

  it('目标在右侧应返回右边缘中点', () => {
    const result = edgePointOnRect(0, 0, 100, 100, 200, 50)
    expect(result).toEqual({ x: 100, y: 50 })
  })

  it('目标在左侧应返回左边缘中点', () => {
    const result = edgePointOnRect(0, 0, 100, 100, -50, 50)
    expect(result).toEqual({ x: 0, y: 50 })
  })

  it('目标在下方应返回下边缘中点', () => {
    const result = edgePointOnRect(0, 0, 100, 100, 50, 200)
    expect(result).toEqual({ x: 50, y: 100 })
  })

  it('目标在上方应返回上边缘中点', () => {
    const result = edgePointOnRect(0, 0, 100, 100, 50, -50)
    expect(result).toEqual({ x: 50, y: 0 })
  })
})

describe('getBestHandles', () => {
  it('目标在右下应选 right → left-target', () => {
    const result = getBestHandles(
      { x: 0, y: 0 }, { w: 100, h: 100 },
      { x: 200, y: 200 }, { w: 100, h: 100 },
    )
    expect(result.sourceHandle).toBe('right')
    expect(result.targetHandle).toBe('left-target')
  })

  it('目标在左上应选 left → right-target', () => {
    const result = getBestHandles(
      { x: 200, y: 200 }, { w: 100, h: 100 },
      { x: 0, y: 0 }, { w: 100, h: 100 },
    )
    expect(result.sourceHandle).toBe('left')
    expect(result.targetHandle).toBe('right-target')
  })

  it('目标在正下方应选 bottom → top-target', () => {
    const result = getBestHandles(
      { x: 50, y: 0 }, { w: 100, h: 100 },
      { x: 50, y: 300 }, { w: 100, h: 100 },
    )
    expect(result.sourceHandle).toBe('bottom')
    expect(result.targetHandle).toBe('top-target')
  })

  it('目标在正上方应选 top → bottom-target', () => {
    const result = getBestHandles(
      { x: 50, y: 300 }, { w: 100, h: 100 },
      { x: 50, y: 0 }, { w: 100, h: 100 },
    )
    expect(result.sourceHandle).toBe('top')
    expect(result.targetHandle).toBe('bottom-target')
  })
})

describe('positionToHandleId', () => {
  it('Position.Top → top', () => {
    expect(positionToHandleId(Position.Top)).toBe('top')
  })
  it('Position.Bottom → bottom', () => {
    expect(positionToHandleId(Position.Bottom)).toBe('bottom')
  })
  it('Position.Left → left', () => {
    expect(positionToHandleId(Position.Left)).toBe('left')
  })
  it('Position.Right → right', () => {
    expect(positionToHandleId(Position.Right)).toBe('right')
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `pnpm test:unit -- src/utils/geometry.test.ts`
Expected: 12 tests PASS

- [ ] **Step 3: 提交**

```bash
git add src/utils/geometry.test.ts
git commit -m "test(utils): add geometry unit tests"
```

---

### Task 6: cardStyles.test.ts

**Files:**
- Create: `src/utils/cardStyles.test.ts`
- Reference: `src/utils/cardStyles.ts`, `src/types/card.ts`

- [ ] **Step 1: 创建完整测试文件**

```typescript
import { describe, it, expect } from 'vitest'
import { getCardFill, getCardStroke, getCardTextColor, getCardMutedTextColor } from './cardStyles'
import { CARD_COLORS, type CardColor } from '../types/card'

describe('getCardFill', () => {
  const colors: CardColor[] = ['white', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'gray']

  it('每种颜色亮模式应返回 fillLight', () => {
    for (const color of colors) {
      expect(getCardFill(color, false)).toBe(CARD_COLORS[color].fillLight)
    }
  })

  it('每种颜色暗模式应返回 fillDark', () => {
    for (const color of colors) {
      expect(getCardFill(color, true)).toBe(CARD_COLORS[color].fillDark)
    }
  })

  it('undefined 应默认白色', () => {
    expect(getCardFill(undefined, false)).toBe(CARD_COLORS.white.fillLight)
    expect(getCardFill(undefined, true)).toBe(CARD_COLORS.white.fillDark)
  })
})

describe('getCardStroke', () => {
  it('每种颜色应返回对应 stroke', () => {
    const colors: CardColor[] = ['white', 'red', 'blue', 'gray']
    for (const color of colors) {
      expect(getCardStroke(color)).toBe(CARD_COLORS[color].stroke)
    }
  })

  it('undefined 应默认白色 stroke', () => {
    expect(getCardStroke(undefined)).toBe(CARD_COLORS.white.stroke)
  })
})

describe('getCardTextColor', () => {
  it('亮模式应返回 textLight', () => {
    expect(getCardTextColor('red', false)).toBe(CARD_COLORS.red.textLight)
  })

  it('暗模式应返回 textDark', () => {
    expect(getCardTextColor('red', true)).toBe(CARD_COLORS.red.textDark)
  })

  it('undefined 应默认白色', () => {
    expect(getCardTextColor(undefined, false)).toBe(CARD_COLORS.white.textLight)
  })
})

describe('getCardMutedTextColor', () => {
  it('white/undefined 亮模式应返回固定灰色', () => {
    expect(getCardMutedTextColor('white', false)).toBe('#9CA3AF')
    expect(getCardMutedTextColor(undefined, false)).toBe('#9CA3AF')
  })

  it('white/undefined 暗模式应返回固定灰色', () => {
    expect(getCardMutedTextColor('white', true)).toBe('#6B7280')
    expect(getCardMutedTextColor(undefined, true)).toBe('#6B7280')
  })

  it('非白色应返回带透明度的文字色', () => {
    const result = getCardMutedTextColor('red', false)
    expect(result).toBe(CARD_COLORS.red.textLight + '99')
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `pnpm test:unit -- src/utils/cardStyles.test.ts`
Expected: 通过

- [ ] **Step 3: 提交**

```bash
git add src/utils/cardStyles.test.ts
git commit -m "test(utils): add cardStyles unit tests"
```

---

### Task 7: fileUtils.test.ts

**Files:**
- Create: `src/utils/fileUtils.test.ts`
- Reference: `src/utils/fileUtils.ts`

- [ ] **Step 1: 创建测试文件（仅测 generateId，fileToDataUrl 依赖浏览器 API 不在此测）**

```typescript
import { describe, it, expect } from 'vitest'
import { generateId } from './fileUtils'

describe('generateId', () => {
  it('默认前缀应为 id- 开头', () => {
    const id = generateId()
    expect(id).toMatch(/^id-\d+-[a-z0-9]{6}$/)
  })

  it('自定义前缀应正确', () => {
    const id = generateId('card')
    expect(id).toMatch(/^card-\d+-[a-z0-9]{6}$/)
  })

  it('每次生成的 ID 应不同', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateId()))
    expect(ids.size).toBe(10)
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `pnpm test:unit -- src/utils/fileUtils.test.ts`
Expected: 3 tests PASS

- [ ] **Step 3: 提交**

```bash
git add src/utils/fileUtils.test.ts
git commit -m "test(utils): add fileUtils generateId unit tests"
```

---

### Task 8: 全量运行验证

- [ ] **Step 1: 运行全部单元测试**

Run: `pnpm test:unit`
Expected: 所有测试 PASS，无 regression

- [ ] **Step 2: 确认测试数量汇总**

| 测试文件 | 预计测试数 |
|---------|-----------|
| cardStore.test.ts | 17 |
| boardStore.test.ts | 12 |
| trashStore.test.ts | 8 |
| syncEngine.test.ts | 8 |
| geometry.test.ts | 12 |
| cardStyles.test.ts | ~10 |
| fileUtils.test.ts | 3 |
| **合计** | **~70** |
