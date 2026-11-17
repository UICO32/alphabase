// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import type { Node, ReactFlowInstance } from '@xyflow/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CanvasSpatialIndex } from '../components/canvas/utils/canvasSpatialIndex'
import { useCanvasDrag } from './useCanvasDrag'
import { embeddingStore } from '../stores/embeddingStore'
import { useFrameInteraction } from '../components/canvas/utils/frameInteraction'
import { kanbanDragPreview } from '../components/canvas/utils/kanbanDragPreview'

afterEach(() => {
  useFrameInteraction.setState({ dragOverFrameId: null })
  kanbanDragPreview.clear()
})

describe('useCanvasDrag spatial index reuse', () => {
  it('queries the shared canvas index for snapping and frame hover', () => {
    const draggedNode = {
      id: 'dragged',
      type: 'card',
      position: { x: 100, y: 100 },
      selected: false,
      data: { width: 280, height: 200 },
    } as Node
    const queryRect = vi.fn(() => [])
    const spatialIndexRef = {
      current: { queryRect, queryPoint: vi.fn(), bounds: [] } as CanvasSpatialIndex,
    }
    const reactFlowInstance = {
      current: {
        getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
        getNodes: () => [draggedNode],
        getNode: () => undefined,
      } as unknown as ReactFlowInstance,
    }
    const setEdges = vi.fn((updater) => {
      if (typeof updater === 'function') updater([])
    })

    const { result } = renderHook(() => useCanvasDrag({
      reactFlowInstance,
      spatialIndexRef,
      setEdges,
      setNodes: vi.fn(),
    }))

    act(() => result.current.onNodeDrag({} as never, draggedNode, [draggedNode]))

    expect(queryRect).toHaveBeenCalledTimes(2)
  })

  it('requests canvas-local related cards when a card drag starts', () => {
    const draggedNode = {
      id: 'dragged',
      type: 'card',
      position: { x: 100, y: 100 },
      selected: false,
      data: { cardId: 'card-1', width: 280, height: 200 },
    } as Node
    const relatedNode = {
      id: 'related',
      type: 'card',
      position: { x: 400, y: 100 },
      selected: false,
      data: { cardId: 'card-2', width: 280, height: 200 },
    } as Node
    const previewRelatedForDrag = vi.fn().mockResolvedValue(undefined)
    const original = embeddingStore.getState().previewRelatedForDrag
    embeddingStore.setState({ previewRelatedForDrag })

    try {
      const { result } = renderHook(() => useCanvasDrag({
        reactFlowInstance: {
          current: { getNodes: () => [draggedNode, relatedNode] } as unknown as ReactFlowInstance,
        },
        spatialIndexRef: { current: {} as CanvasSpatialIndex },
        setEdges: vi.fn(),
        setNodes: vi.fn(),
      }))

      act(() => result.current.onNodeDragStart({} as never, draggedNode))

      expect(previewRelatedForDrag).toHaveBeenCalledWith('card-1', ['card-1', 'card-2'])
    } finally {
      embeddingStore.setState({ previewRelatedForDrag: original })
    }
  })

  it('拖拽期间使用开始时的冻结索引，不再读每帧重建的索引', () => {
    const draggedNode = {
      id: 'dragged',
      type: 'card',
      position: { x: 100, y: 100 },
      selected: true,
      data: { cardId: 'card-1', width: 280, height: 200 },
    } as Node
    const frameNode = {
      id: 'frame-1',
      type: 'frame',
      position: { x: 100, y: 100 },
      data: { layout: 'free', width: 600, height: 400 },
    } as Node
    const liveQueryRect = vi.fn(() => [])
    const spatialIndexRef = {
      current: { queryRect: liveQueryRect, queryPoint: vi.fn(), bounds: [] } as CanvasSpatialIndex,
    }
    const reactFlowInstance = {
      current: {
        getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
        getNodes: () => [draggedNode, frameNode],
        getNode: (id: string) => (id === 'frame-1' ? frameNode : undefined),
      } as unknown as ReactFlowInstance,
    }

    const { result } = renderHook(() => useCanvasDrag({
      reactFlowInstance,
      spatialIndexRef,
      setEdges: vi.fn(),
      setNodes: vi.fn(),
    }))

    act(() => result.current.onNodeDragStart({} as never, draggedNode))
    // 模拟画布每帧重建索引：拖拽开始后把共享索引换成空索引。
    spatialIndexRef.current = { queryRect: liveQueryRect, queryPoint: vi.fn(), bounds: [] } as CanvasSpatialIndex
    act(() => result.current.onNodeDrag({} as never, draggedNode, [draggedNode]))

    // 冻结索引里包含 frame-1，所以悬停判定仍能命中；换成共享索引则会返回空。
    expect(useFrameInteraction.getState().dragOverFrameId).toBe('frame-1')
    expect(liveQueryRect).not.toHaveBeenCalled()
  })

  it('每次拖拽事件只取一次节点快照', () => {
    const draggedNode = {
      id: 'dragged',
      type: 'card',
      position: { x: 40, y: 40 },
      selected: true,
      data: { cardId: 'card-1', frameId: 'frame-1', width: 260, height: 100 },
    } as Node
    const frameNode = {
      id: 'frame-1',
      type: 'frame',
      position: { x: 0, y: 0 },
      data: { layout: 'kanban', width: 600, height: 400 },
    } as Node
    const getNodes = vi.fn(() => [draggedNode, frameNode])
    const reactFlowInstance = {
      current: {
        getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
        getNodes,
        getNode: (id: string) => (id === 'frame-1' ? frameNode : undefined),
      } as unknown as ReactFlowInstance,
    }

    const { result } = renderHook(() => useCanvasDrag({
      reactFlowInstance,
      spatialIndexRef: { current: { queryRect: () => [], queryPoint: vi.fn(), bounds: [] } as unknown as CanvasSpatialIndex },
      setEdges: vi.fn(),
      setNodes: vi.fn(),
    }))

    act(() => result.current.onNodeDragStart({} as never, draggedNode))
    const callsAfterStart = getNodes.mock.calls.length
    act(() => result.current.onNodeDrag({} as never, draggedNode, [draggedNode]))

    // 基线（修改前）：看板卡片拖拽事件里 getNodes 调 2 次（吸附 + 看板兄弟节点）；
    // 现在整次事件只取一次快照。
    expect(getNodes.mock.calls.length - callsAfterStart).toBe(1)
    expect(kanbanDragPreview.get()?.frameId).toBe('frame-1')
  })
})
