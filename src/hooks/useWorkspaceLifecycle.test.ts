// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceLifecycle } from './useWorkspaceLifecycle'
import { useBoardStore } from '../stores/boardStore'
import { setActiveSyncEngine } from '../sync/syncEngineRef'
import { getBoardHydrationSeq } from '../sync/boardHydration'

const BOARD_A = 'board-a'
const BOARD_B = 'board-b'

function card(id: string, x: number): Node {
  return { id, type: 'card', position: { x, y: 0 }, data: { cardId: id } }
}

function createEngine() {
  return {
    scheduleWriteBoard: vi.fn(),
    scheduleWriteCard: vi.fn(),
    stop: vi.fn(async () => {}),
    flushAll: vi.fn(async () => {}),
    discard: vi.fn(),
    isRunning: () => true,
    getWorkspacePath: () => 'D:/ws',
  }
}

let engine: ReturnType<typeof createEngine>

beforeEach(() => {
  cleanup()
  engine = createEngine()
  setActiveSyncEngine(engine as never)
  useBoardStore.setState({
    boards: [
      { id: BOARD_A, name: 'A', createdAt: 1, updatedAt: 1 },
      { id: BOARD_B, name: 'B', createdAt: 2, updatedAt: 2 },
    ],
    activeBoardId: BOARD_A,
    isLoaded: true,
    boardData: {
      [BOARD_A]: { nodes: [card('a', 10) as never], edges: [] },
      [BOARD_B]: { nodes: [card('b', 300) as never], edges: [] },
    },
  })
})

afterEach(() => {
  setActiveSyncEngine(null)
  useBoardStore.setState({ boards: [], activeBoardId: null, isLoaded: false, boardData: {} })
})

function renderLifecycle(nodes: Node[], edges: Edge[] = []) {
  const setNodes = vi.fn()
  const setEdges = vi.fn()
  const nodesRef = { current: nodes }
  const edgesRef = { current: edges }
  const viewportRef = { current: { x: 0, y: 0, zoom: 1 } }
  const hook = renderHook(() => useWorkspaceLifecycle({
    setNodes,
    setEdges,
    nodesRef: nodesRef as never,
    edgesRef: edgesRef as never,
    viewportRef: viewportRef as never,
  }))
  return { ...hook, setNodes, setEdges, nodesRef }
}

describe('useWorkspaceLifecycle 切板落盘', () => {
  it('切换画板时先保存旧画板的当前节点位置', () => {
    // 模拟用户拖动后 React Flow 里的最新位置（与 store 中的旧位置不同）。
    const { nodesRef } = renderLifecycle([card('a', 120)])

    act(() => {
      useBoardStore.getState().setActiveBoard(BOARD_B)
    })

    expect(engine.scheduleWriteBoard).toHaveBeenCalledTimes(1)
    const [boardId, snapshot] = engine.scheduleWriteBoard.mock.calls[0]
    expect(boardId).toBe(BOARD_A)
    expect(snapshot.nodes[0].position.x).toBe(120)
    // store 里旧画板的数据同步为最新位置，后续读取不会再回退。
    expect(useBoardStore.getState().getBoardData(BOARD_A)?.nodes[0].position.x).toBe(120)
    expect(nodesRef.current).toEqual([card('a', 120)])
  })

  it('切换画板后加载目标画板的快照并标记水合', () => {
    const { setNodes, setEdges } = renderLifecycle([card('a', 120)])
    const hydrationBefore = getBoardHydrationSeq()

    act(() => {
      useBoardStore.getState().setActiveBoard(BOARD_B)
    })

    expect(setEdges).toHaveBeenLastCalledWith([])
    expect(setNodes).toHaveBeenCalled()
    // 水合序号递增，useBoardSync 据此跳过“切板即写盘”。
    expect(getBoardHydrationSeq()).toBeGreaterThan(hydrationBefore)
  })
})
