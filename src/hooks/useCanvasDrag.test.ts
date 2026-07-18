// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import type { Node, ReactFlowInstance } from '@xyflow/react'
import { describe, expect, it, vi } from 'vitest'
import type { CanvasSpatialIndex } from '../components/canvas/utils/canvasSpatialIndex'
import { useCanvasDrag } from './useCanvasDrag'

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
})
