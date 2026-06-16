import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import type { CardNodeData } from '../types/card'
import type { FrameNodeData, FrameLayoutSnapshot } from '../components/canvas/FrameNode'
import {
  computeLayout,
  saveCardSnapshots,
  saveFrameSnapshot,
  restoreOrComputePositions,
  restoreFrameDimensions,
  updateSingleCardSnapshot,
  DEFAULT_KANBAN_COLUMNS,
  type FrameLayout,
  type KanbanColumn,
} from './frameLayouts'

function makeFrameNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'frame-1',
    type: 'frame',
    position: { x: 100, y: 100 },
    data: {
      width: 600,
      height: 400,
      name: 'Test Frame',
    } satisfies FrameNodeData,
    ...overrides,
  }
}

function makeCardNode(id: string, overrides: Partial<Node> = {}): Node {
  return {
    id,
    type: 'card',
    position: { x: 120, y: 160 },
    data: {
      cardId: id,
      color: 'white' as const,
      localX: 20,
      localY: 60,
      width: 200,
      height: 150,
    } satisfies CardNodeData,
    ...overrides,
  }
}

// ─── computeLayout 分发 ───

describe('computeLayout', () => {
  it('layout="free" 分发到 computeFreeLayout', () => {
    const frame = makeFrameNode()
    const children = [makeCardNode('c1')]
    const result = computeLayout(frame, children, 'free')
    expect(result.positions['c1']).toEqual({ x: 20, y: 60 })
  })

  it('layout="bento" 分发到 computeBentoLayout', () => {
    const frame = makeFrameNode()
    const children = [makeCardNode('c1')]
    const result = computeLayout(frame, children, 'bento')
    expect(result.positions['c1']).toEqual(
      expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }),
    )
  })

  it('layout="kanban" 分发到 computeKanbanLayout', () => {
    const frame = makeFrameNode()
    const children = [makeCardNode('c1')]
    const result = computeLayout(frame, children, 'kanban')
    expect(result.positions['c1']).toEqual(
      expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }),
    )
  })

  it('layout=undefined 走 free 分支', () => {
    const frame = makeFrameNode()
    const children = [makeCardNode('c1')]
    const result = computeLayout(frame, children, undefined as unknown as FrameLayout)
    expect(result.positions['c1']).toEqual({ x: 20, y: 60 })
  })
})

// ─── computeBentoLayout（通过 computeLayout 间接测试）───

describe('computeBentoLayout', () => {
  const frame = makeFrameNode()
  const PADDING = 16
  const HEADER_HEIGHT = 44
  const GAP = 12
  const contentW = 600 - PADDING * 2
  const contentH = 400 - HEADER_HEIGHT - PADDING * 2
  const colW = Math.floor((contentW - GAP) / 2)

  it('0 张卡片 → 空 positions', () => {
    const result = computeLayout(frame, [], 'bento')
    expect(result.positions).toEqual({})
  })

  it('1 张卡片 → 占满整行', () => {
    const children = [makeCardNode('c1')]
    const result = computeLayout(frame, children, 'bento')
    expect(result.positions['c1']).toEqual({
      x: PADDING,
      y: HEADER_HEIGHT + PADDING,
      width: contentW,
      height: contentH,
    })
  })

  it('2 张卡片 → 左右各半', () => {
    const children = [makeCardNode('c1'), makeCardNode('c2')]
    const result = computeLayout(frame, children, 'bento')
    expect(result.positions['c1']).toEqual({
      x: PADDING,
      y: HEADER_HEIGHT + PADDING,
      width: colW,
      height: contentH,
    })
    expect(result.positions['c2']).toEqual({
      x: PADDING + colW + GAP,
      y: HEADER_HEIGHT + PADDING,
      width: colW,
      height: contentH,
    })
  })

  it('3 张卡片 → 顶部 1 张占满，底部 2 张各半', () => {
    const children = [makeCardNode('c1'), makeCardNode('c2'), makeCardNode('c3')]
    const result = computeLayout(frame, children, 'bento')
    const topH = Math.floor(contentH * 0.45)
    const bottomH = contentH - topH - GAP

    expect(result.positions['c1']).toEqual({
      x: PADDING,
      y: HEADER_HEIGHT + PADDING,
      width: contentW,
      height: topH,
    })
    expect(result.positions['c2']).toEqual({
      x: PADDING,
      y: HEADER_HEIGHT + PADDING + topH + GAP,
      width: colW,
      height: bottomH,
    })
    expect(result.positions['c3']).toEqual({
      x: PADDING + colW + GAP,
      y: HEADER_HEIGHT + PADDING + topH + GAP,
      width: colW,
      height: bottomH,
    })
  })

  it('4+ 张卡片 → 2 列网格，最后一行奇数时单张占满', () => {
    const children = [makeCardNode('c1'), makeCardNode('c2'), makeCardNode('c3'), makeCardNode('c4'), makeCardNode('c5')]
    const result = computeLayout(frame, children, 'bento')
    const rows = Math.ceil(5 / 2)
    const rowH = Math.floor((contentH - (rows - 1) * GAP) / rows)

    // c1 row 0 col 0
    expect(result.positions['c1']).toEqual({
      x: PADDING,
      y: HEADER_HEIGHT + PADDING,
      width: colW,
      height: rowH,
    })
    // c4 row 1 col 1
    expect(result.positions['c4']).toEqual({
      x: PADDING + colW + GAP,
      y: HEADER_HEIGHT + PADDING + (rowH + GAP),
      width: colW,
      height: rowH,
    })
    // c5 最后一行奇数 → 占满整行
    expect(result.positions['c5']).toEqual({
      x: PADDING,
      y: HEADER_HEIGHT + PADDING + 2 * (rowH + GAP),
      width: contentW,
      height: rowH,
    })
  })

  it('Frame 尺寸缺失时用默认值 600/400', () => {
    const frameNoSize = makeFrameNode({ data: { width: undefined as unknown as number, height: undefined as unknown as number, name: 'Test' } })
    const children = [makeCardNode('c1')]
    const result = computeLayout(frameNoSize, children, 'bento')
    expect(result.positions['c1']).toEqual(
      expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }),
    )
  })
})

// ─── computeKanbanLayout ───

describe('computeKanbanLayout', () => {
  it('无 columns 配置时用 DEFAULT_KANBAN_COLUMNS，按轮询分配', () => {
    const frame = makeFrameNode()
    const children = [makeCardNode('c1'), makeCardNode('c2'), makeCardNode('c3'), makeCardNode('c4')]
    const result = computeLayout(frame, children, 'kanban')
    const numCols = DEFAULT_KANBAN_COLUMNS.length
    const colWidth = Math.floor((600 - 16 * 2 - (numCols - 1) * 16) / numCols)

    // c1 在 col 0, c2 在 col 1, c3 在 col 2, c4 在 col 0
    expect(result.positions['c1'].x).toBe(16)
    expect(result.positions['c2'].x).toBe(16 + colWidth + 16)
    expect(result.positions['c3'].x).toBe(16 + 2 * (colWidth + 16))
    expect(result.positions['c4'].x).toBe(16)
  })

  it('有 cardIds 时按 cardIds 分配，未匹配的放最后一列', () => {
    const columns: KanbanColumn[] = [
      { id: 'col-0', title: 'A', cardIds: ['c1'] },
      { id: 'col-1', title: 'B', cardIds: ['c2'] },
      { id: 'col-2', title: 'C' },
    ]
    const frame = makeFrameNode({ data: { width: 600, height: 400, name: 'Test', columns } })
    const children = [makeCardNode('c1'), makeCardNode('c2'), makeCardNode('c3')]
    const result = computeLayout(frame, children, 'kanban')
    const numCols = 3
    const colWidth = Math.floor((600 - 16 * 2 - (numCols - 1) * 16) / numCols)

    // c1 在 col 0
    expect(result.positions['c1'].x).toBe(16)
    // c2 在 col 1
    expect(result.positions['c2'].x).toBe(16 + colWidth + 16)
    // c3 未匹配 → 最后一列 col 2
    expect(result.positions['c3'].x).toBe(16 + 2 * (colWidth + 16))
  })

  it('空卡片列表 → 空 positions', () => {
    const frame = makeFrameNode()
    const result = computeLayout(frame, [], 'kanban')
    expect(result.positions).toEqual({})
  })
})

// ─── computeFreeLayout ───

describe('computeFreeLayout', () => {
  it('localX/localY 存在时优先使用', () => {
    const frame = makeFrameNode()
    const children = [makeCardNode('c1', { data: { cardId: 'c1', color: 'white', localX: 50, localY: 80 } })]
    const result = computeLayout(frame, children, 'free')
    expect(result.positions['c1']).toEqual({ x: 50, y: 80 })
  })

  it('localX/localY 不存在时用 node.position', () => {
    const frame = makeFrameNode()
    const children = [makeCardNode('c1', { position: { x: 200, y: 300 }, data: { cardId: 'c1', color: 'white' } })]
    const result = computeLayout(frame, children, 'free')
    expect(result.positions['c1']).toEqual({ x: 200, y: 300 })
  })
})

// ─── saveCardSnapshots ───

describe('saveCardSnapshots', () => {
  it('localX/localY 已有时保留原值', () => {
    const children = [makeCardNode('c1', { data: { cardId: 'c1', color: 'white', localX: 30, localY: 70, width: 200, height: 150 } })]
    const result = saveCardSnapshots(children, { x: 100, y: 100 }, 'free')
    const snapshot = result.get('c1')!.layoutSnapshots!.free!
    expect(snapshot.localX).toBe(30)
    expect(snapshot.localY).toBe(70)
  })

  it('localX/localY 不存在时从绝对坐标计算', () => {
    const children = [makeCardNode('c1', { position: { x: 150, y: 180 }, data: { cardId: 'c1', color: 'white', width: 200, height: 150 } })]
    const result = saveCardSnapshots(children, { x: 100, y: 100 }, 'free')
    const snapshot = result.get('c1')!.layoutSnapshots!.free!
    expect(snapshot.localX).toBe(50)
    expect(snapshot.localY).toBe(80)
  })

  it('返回 Map，key 为 nodeId', () => {
    const children = [makeCardNode('c1'), makeCardNode('c2')]
    const result = saveCardSnapshots(children, { x: 100, y: 100 }, 'free')
    expect(result.has('c1')).toBe(true)
    expect(result.has('c2')).toBe(true)
    expect(result.size).toBe(2)
  })
})

// ─── saveFrameSnapshot ───

describe('saveFrameSnapshot', () => {
  it('保存 width/height 到 layoutSnapshots[layout]', () => {
    const frameData: FrameNodeData = { width: 600, height: 400, name: 'Test' }
    const result = saveFrameSnapshot(frameData, 'free')
    expect(result.layoutSnapshots!.free).toEqual({
      width: 600,
      height: 400,
      columns: undefined,
      version: 0,
    })
  })

  it('layout="kanban" 时额外保存 columns', () => {
    const columns: KanbanColumn[] = [{ id: 'col-0', title: 'A' }]
    const frameData: FrameNodeData = { width: 800, height: 500, name: 'Test', columns }
    const result = saveFrameSnapshot(frameData, 'kanban')
    expect(result.layoutSnapshots!.kanban!.columns).toEqual(columns)
  })

  it('layout="free" 时不保存 columns', () => {
    const columns: KanbanColumn[] = [{ id: 'col-0', title: 'A' }]
    const frameData: FrameNodeData = { width: 800, height: 500, name: 'Test', columns }
    const result = saveFrameSnapshot(frameData, 'free')
    expect(result.layoutSnapshots!.free!.columns).toBeUndefined()
  })

  it('不修改原 frameData', () => {
    const frameData: FrameNodeData = { width: 600, height: 400, name: 'Test' }
    const original = { ...frameData }
    saveFrameSnapshot(frameData, 'free')
    expect(frameData).toEqual(original)
  })

  it('保存 snapshotVersion 到 version 字段', () => {
    const frameData: FrameNodeData = { width: 600, height: 400, name: 'Test', snapshotVersion: 5 }
    const result = saveFrameSnapshot(frameData, 'free')
    expect(result.layoutSnapshots!.free!.version).toBe(5)
  })
})

// ─── restoreOrComputePositions ───

describe('restoreOrComputePositions', () => {
  it('bento → 始终重新计算', () => {
    const frame = makeFrameNode()
    const children = [makeCardNode('c1')]
    const cardDataUpdates = new Map<string, CardNodeData>()
    cardDataUpdates.set('c1', {
      cardId: 'c1',
      color: 'white',
      layoutSnapshots: { bento: { localX: 999, localY: 999 } },
    })
    const result = restoreOrComputePositions(frame, children, 'bento', cardDataUpdates)
    expect(result.positions['c1']).not.toEqual({ x: 999, y: 999 })
  })

  it('free + 有快照 → 从快照恢复', () => {
    const frame = makeFrameNode()
    const children = [makeCardNode('c1')]
    const cardDataUpdates = new Map<string, CardNodeData>()
    cardDataUpdates.set('c1', {
      cardId: 'c1',
      color: 'white',
      layoutSnapshots: { free: { localX: 42, localY: 87, width: 200, height: 150 } },
    })
    const result = restoreOrComputePositions(frame, children, 'free', cardDataUpdates)
    expect(result.positions['c1']).toEqual({ x: 42, y: 87, width: 200, height: 150 })
  })

  it('free + 无快照 → 用当前相对位置', () => {
    const frame = makeFrameNode()
    const children = [makeCardNode('c1', { data: { cardId: 'c1', color: 'white', localX: 15, localY: 25, width: 200, height: 150 } })]
    const cardDataUpdates = new Map<string, CardNodeData>()
    cardDataUpdates.set('c1', { cardId: 'c1', color: 'white' })
    const result = restoreOrComputePositions(frame, children, 'free', cardDataUpdates)
    expect(result.positions['c1']).toEqual({ x: 15, y: 25, width: 200, height: 150 })
  })

  it('kanban + 版本过期 → 重新排列', () => {
    const frame = makeFrameNode({
      data: {
        width: 600,
        height: 400,
        name: 'Test',
        layoutSnapshots: {
          kanban: { width: 600, height: 400, version: 1 },
        } as Record<FrameLayout, FrameLayoutSnapshot>,
      },
    })
    const children = [makeCardNode('c1')]
    const cardDataUpdates = new Map<string, CardNodeData>()
    cardDataUpdates.set('c1', {
      cardId: 'c1',
      color: 'white',
      layoutSnapshots: { kanban: { localX: 999, localY: 999 } },
    })
    const result = restoreOrComputePositions(frame, children, 'kanban', cardDataUpdates, 3)
    expect(result.positions['c1']).not.toEqual({ x: 999, y: 999 })
  })

  it('kanban + 版本未过期 + 有快照 → 从快照恢复', () => {
    const frame = makeFrameNode({
      data: {
        width: 600,
        height: 400,
        name: 'Test',
        layoutSnapshots: {
          kanban: { width: 600, height: 400, version: 5 },
        } as Record<FrameLayout, FrameLayoutSnapshot>,
      },
    })
    const children = [makeCardNode('c1')]
    const cardDataUpdates = new Map<string, CardNodeData>()
    cardDataUpdates.set('c1', {
      cardId: 'c1',
      color: 'white',
      layoutSnapshots: { kanban: { localX: 50, localY: 100, width: 170, height: 140 } },
    })
    const result = restoreOrComputePositions(frame, children, 'kanban', cardDataUpdates, 3)
    expect(result.positions['c1']).toEqual({ x: 50, y: 100, width: 170, height: 140 })
  })

  it('kanban + 版本未过期 + 无快照 → 用计算值', () => {
    const frame = makeFrameNode({
      data: {
        width: 600,
        height: 400,
        name: 'Test',
        layoutSnapshots: {
          kanban: { width: 600, height: 400, version: 5 },
        } as Record<FrameLayout, FrameLayoutSnapshot>,
      },
    })
    const children = [makeCardNode('c1')]
    const cardDataUpdates = new Map<string, CardNodeData>()
    cardDataUpdates.set('c1', { cardId: 'c1', color: 'white' })
    const computed = computeLayout(frame, children, 'kanban')
    const result = restoreOrComputePositions(frame, children, 'kanban', cardDataUpdates, 3)
    expect(result.positions['c1']).toEqual(computed.positions['c1'])
  })
})

// ─── restoreFrameDimensions ───

describe('restoreFrameDimensions', () => {
  it('bento → 始终返回当前尺寸', () => {
    const frameData: FrameNodeData = {
      width: 600,
      height: 400,
      name: 'Test',
      layoutSnapshots: { bento: { width: 800, height: 600, version: 10 } },
    }
    const result = restoreFrameDimensions(frameData, 'bento')
    expect(result).toEqual({ width: 600, height: 400 })
  })

  it('free + 快照版本 >= 当前版本 → 恢复快照尺寸', () => {
    const frameData: FrameNodeData = {
      width: 600,
      height: 400,
      name: 'Test',
      snapshotVersion: 3,
      layoutSnapshots: { free: { width: 800, height: 600, version: 5 } },
    }
    const result = restoreFrameDimensions(frameData, 'free')
    expect(result).toEqual({ width: 800, height: 600 })
  })

  it('free + 快照版本 < 当前版本 → 用当前尺寸', () => {
    const frameData: FrameNodeData = {
      width: 600,
      height: 400,
      name: 'Test',
      snapshotVersion: 10,
      layoutSnapshots: { free: { width: 800, height: 600, version: 3 } },
    }
    const result = restoreFrameDimensions(frameData, 'free')
    expect(result).toEqual({ width: 600, height: 400 })
  })

  it('kanban + 快照版本 >= 当前版本 → 恢复快照尺寸 + columns', () => {
    const columns: KanbanColumn[] = [{ id: 'col-0', title: 'A' }]
    const frameData: FrameNodeData = {
      width: 600,
      height: 400,
      name: 'Test',
      snapshotVersion: 3,
      layoutSnapshots: { kanban: { width: 800, height: 600, columns, version: 5 } },
    }
    const result = restoreFrameDimensions(frameData, 'kanban')
    expect(result).toEqual({ width: 800, height: 600, columns })
  })

  it('kanban + 快照版本 < 当前版本 → 用当前尺寸 + DEFAULT_KANBAN_COLUMNS', () => {
    const frameData: FrameNodeData = {
      width: 600,
      height: 400,
      name: 'Test',
      snapshotVersion: 10,
      layoutSnapshots: { kanban: { width: 800, height: 600, columns: [{ id: 'x', title: 'Y' }], version: 3 } },
    }
    const result = restoreFrameDimensions(frameData, 'kanban')
    expect(result).toEqual({ width: 600, height: 400, columns: DEFAULT_KANBAN_COLUMNS })
  })

  it('无快照时返回当前尺寸', () => {
    const frameData: FrameNodeData = {
      width: 600,
      height: 400,
      name: 'Test',
    }
    const result = restoreFrameDimensions(frameData, 'free')
    expect(result).toEqual({ width: 600, height: 400 })
  })
})

// ─── updateSingleCardSnapshot ───

describe('updateSingleCardSnapshot', () => {
  it('更新 layoutSnapshots[layout] 的 localX/localY', () => {
    const cardData: CardNodeData = {
      cardId: 'c1',
      color: 'white',
      layoutSnapshots: { free: { localX: 10, localY: 20 } },
    }
    const result = updateSingleCardSnapshot(cardData, 'free', 30, 40)
    expect(result.layoutSnapshots!.free).toEqual({ localX: 30, localY: 40, width: undefined, height: undefined })
  })

  it('width/height 可选传入', () => {
    const cardData: CardNodeData = {
      cardId: 'c1',
      color: 'white',
    }
    const result = updateSingleCardSnapshot(cardData, 'bento', 10, 20, 300, 200)
    expect(result.layoutSnapshots!.bento).toEqual({ localX: 10, localY: 20, width: 300, height: 200 })
  })

  it('不修改原 cardData', () => {
    const cardData: CardNodeData = {
      cardId: 'c1',
      color: 'white',
      layoutSnapshots: { free: { localX: 10, localY: 20 } },
    }
    const original = JSON.parse(JSON.stringify(cardData))
    updateSingleCardSnapshot(cardData, 'free', 30, 40)
    expect(cardData).toEqual(original)
  })

  it('保留其他 layout 的快照', () => {
    const cardData: CardNodeData = {
      cardId: 'c1',
      color: 'white',
      layoutSnapshots: {
        free: { localX: 10, localY: 20 },
        kanban: { localX: 50, localY: 60, width: 170, height: 140 },
      },
    }
    const result = updateSingleCardSnapshot(cardData, 'free', 30, 40)
    expect(result.layoutSnapshots!.kanban).toEqual({ localX: 50, localY: 60, width: 170, height: 140 })
    expect(result.layoutSnapshots!.free).toEqual({ localX: 30, localY: 40, width: undefined, height: undefined })
  })
})
