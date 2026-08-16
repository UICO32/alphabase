// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import type { Node, ReactFlowInstance } from '@xyflow/react'
import { describe, expect, it, vi } from 'vitest'
import type { CanvasSpatialIndex } from '../components/canvas/utils/canvasSpatialIndex'
import { useCanvasDrag } from './useCanvasDrag'
import { embeddingStore } from '../stores/embeddingStore'

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
})
