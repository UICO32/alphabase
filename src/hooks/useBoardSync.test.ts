// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBoardSync } from './useBoardSync'
import { useBoardStore } from '../stores/boardStore'
import { setActiveSyncEngine } from '../sync/syncEngineRef'
import { markBoardHydrated } from '../sync/boardHydration'

const BOARD_ID = 'board-1'

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

function resetBoardStore() {
  useBoardStore.setState({
    boards: [{ id: BOARD_ID, name: '画板', createdAt: 1, updatedAt: 1 }],
    activeBoardId: BOARD_ID,
    isLoaded: true,
    boardData: { [BOARD_ID]: { nodes: [], edges: [] } },
  })
}

function renderBoardSync(initialNodes: Node[], initialEdges: Edge[] = []) {
  const viewportRef = { current: { x: 0, y: 0, zoom: 1 } }
  return renderHook(
    ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => useBoardSync({ nodes, edges, viewportRef }),
    { initialProps: { nodes: initialNodes, edges: initialEdges } },
  )
}

let engine: ReturnType<typeof createEngine>

beforeEach(() => {
  // 先卸载上一个用例的 hook：它的清理逻辑会排盘，必须在换引擎之前完成。
  cleanup()
  vi.useFakeTimers()
  engine = createEngine()
  setActiveSyncEngine(engine as never)
  resetBoardStore()
})

afterEach(() => {
  vi.clearAllTimers()
  setActiveSyncEngine(null)
  useBoardStore.setState({ boards: [], activeBoardId: null, isLoaded: false, boardData: {} })
  vi.useRealTimers()
})

describe('useBoardSync 节点/边改动排盘', () => {
  it('把节点位置改动合并成一次 600ms 后的快照写入', () => {
    const { rerender } = renderBoardSync([card('a', 0)])

    // 模拟拖拽：连续多次位置变化，期间不得写盘。
    for (let x = 1; x <= 5; x += 1) {
      act(() => { rerender({ nodes: [card('a', x)], edges: [] }) })
      act(() => { vi.advanceTimersByTime(100) })
    }
    expect(engine.scheduleWriteBoard).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(600) })

    expect(engine.scheduleWriteBoard).toHaveBeenCalledTimes(1)
    const [boardId, snapshot] = engine.scheduleWriteBoard.mock.calls[0]
    expect(boardId).toBe(BOARD_ID)
    expect(snapshot.nodes[0].position.x).toBe(5)
    expect(useBoardStore.getState().getBoardData(BOARD_ID)?.nodes[0].position.x).toBe(5)
  })

  it('边改动同样进入防抖排盘', () => {
    const edge: Edge = { id: 'e1', source: 'a', target: 'b' }
    const { rerender } = renderBoardSync([card('a', 0), card('b', 200)])

    act(() => { rerender({ nodes: [card('a', 0), card('b', 200)], edges: [edge] }) })
    act(() => { vi.advanceTimersByTime(600) })

    expect(engine.scheduleWriteBoard).toHaveBeenCalledTimes(1)
    expect(engine.scheduleWriteBoard.mock.calls[0][1].edges).toEqual([
      expect.objectContaining({ id: 'e1', source: 'a', target: 'b' }),
    ])
  })

  it('水合刚完成的第一次变化不排盘', () => {
    markBoardHydrated()
    renderBoardSync([card('a', 0)])

    act(() => { vi.advanceTimersByTime(1200) })

    expect(engine.scheduleWriteBoard).not.toHaveBeenCalled()
  })

  it('水合之后的下一次真实改动恢复排盘', () => {
    markBoardHydrated()
    const { rerender } = renderBoardSync([card('a', 0)])

    act(() => { rerender({ nodes: [card('a', 40)], edges: [] }) })
    act(() => { vi.advanceTimersByTime(600) })

    expect(engine.scheduleWriteBoard).toHaveBeenCalledTimes(1)
    expect(engine.scheduleWriteBoard.mock.calls[0][1].nodes[0].position.x).toBe(40)
  })

  it('未完成加载（isLoaded=false）时不排盘', () => {
    useBoardStore.setState({ isLoaded: false })
    const { rerender } = renderBoardSync([])

    act(() => { rerender({ nodes: [card('a', 0)], edges: [] }) })
    act(() => { vi.advanceTimersByTime(1200) })

    expect(engine.scheduleWriteBoard).not.toHaveBeenCalled()
  })
})
