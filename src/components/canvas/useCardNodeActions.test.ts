// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCardNodeActions } from './useCardNodeActions'
import { useBoardStore } from '../../stores/boardStore'
import { setActiveSyncEngine } from '../../sync/syncEngineRef'

const SOURCE_BOARD = 'board-a'
const TARGET_BOARD = 'board-b'
const CARD_ID = 'card-1'

const cardNode: Node = {
  id: CARD_ID,
  type: 'card',
  position: { x: 40, y: 60 },
  data: { cardId: CARD_ID, width: 280, height: 200 },
}

const relatedEdge: Edge = { id: 'edge-1', source: CARD_ID, target: 'card-2' }
const unrelatedEdge: Edge = { id: 'edge-2', source: 'card-2', target: 'card-3' }
const existingTargetNode = {
  id: 'card-9',
  type: 'card',
  position: { x: 0, y: 0 },
  data: { cardId: 'card-9' },
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
      { id: SOURCE_BOARD, name: 'A', createdAt: 1, updatedAt: 1 },
      { id: TARGET_BOARD, name: 'B', createdAt: 2, updatedAt: 2 },
    ],
    activeBoardId: SOURCE_BOARD,
    isLoaded: true,
    boardData: {
      [SOURCE_BOARD]: { nodes: [cardNode as never], edges: [relatedEdge as never, unrelatedEdge as never] },
      [TARGET_BOARD]: { nodes: [existingTargetNode], edges: [] },
    },
  })
})

afterEach(() => {
  setActiveSyncEngine(null)
  useBoardStore.setState({ boards: [], activeBoardId: null, isLoaded: false, boardData: {} })
})

function renderActions() {
  const setNodes = vi.fn()
  const setEdges = vi.fn()
  const hook = renderHook(() => useCardNodeActions({
    cardId: CARD_ID,
    isCollapsed: false,
    updateCard: vi.fn(),
    setNodes: setNodes as never,
    setEdges: setEdges as never,
    getNode: ((id: string) => (id === CARD_ID ? cardNode : undefined)) as never,
    getEdges: (() => [relatedEdge, unrelatedEdge]) as never,
  }))
  return { ...hook, setNodes, setEdges }
}

describe('useCardNodeActions.handleMoveToBoard', () => {
  it('把节点和相关边不可变地写入目标画板，并立即排一次快照落盘', () => {
    const originalTarget = useBoardStore.getState().boardData[TARGET_BOARD]
    const { result, setNodes, setEdges } = renderActions()

    act(() => {
      result.current.handleMoveToBoard(TARGET_BOARD)
    })

    const target = useBoardStore.getState().getBoardData(TARGET_BOARD)!
    expect(target.nodes.map(node => node.id)).toEqual(['card-9', CARD_ID])
    expect(target.edges.map(edge => edge.id)).toEqual(['edge-1'])
    expect(target.nodes.find(node => node.id === CARD_ID)?.position).toEqual({ x: 40, y: 60 })

    // store 里原来的对象不被就地修改。
    expect(originalTarget.nodes).toHaveLength(1)
    expect(originalTarget.edges).toHaveLength(0)

    // 源画板节点移除、只保留无关边。
    expect(setNodes).toHaveBeenCalledTimes(1)
    const removeUpdater = setNodes.mock.calls[0][0] as (nodes: Node[]) => Node[]
    expect(removeUpdater([cardNode]).map(node => node.id)).toEqual([])
    expect(setEdges).toHaveBeenCalledWith([unrelatedEdge])

    expect(engine.scheduleWriteBoard).toHaveBeenCalledTimes(1)
    const [boardId, snapshot] = engine.scheduleWriteBoard.mock.calls[0]
    expect(boardId).toBe(TARGET_BOARD)
    expect(snapshot.nodes).toHaveLength(2)
    expect(snapshot.edges).toEqual([
      expect.objectContaining({ id: 'edge-1', source: CARD_ID, target: 'card-2', type: 'connection' }),
    ])
    expect(snapshot.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('重复调用不会重复插入节点和边', () => {
    const { result } = renderActions()

    act(() => {
      result.current.handleMoveToBoard(TARGET_BOARD)
      result.current.handleMoveToBoard(TARGET_BOARD)
    })

    const target = useBoardStore.getState().getBoardData(TARGET_BOARD)!
    expect(target.nodes.map(node => node.id)).toEqual(['card-9', CARD_ID])
    expect(target.edges.map(edge => edge.id)).toEqual(['edge-1'])
  })

  it('目标画板没有已加载数据时也能写入并保留节点字段', () => {
    useBoardStore.setState(state => {
      const { [TARGET_BOARD]: _removed, ...rest } = state.boardData
      return { boardData: rest }
    })
    const { result } = renderActions()

    act(() => {
      result.current.handleMoveToBoard(TARGET_BOARD)
    })

    const target = useBoardStore.getState().getBoardData(TARGET_BOARD)!
    expect(target.nodes).toHaveLength(1)
    expect(target.nodes[0]).toMatchObject({ id: CARD_ID, type: 'card', width: 280, height: 200 })
  })
})
