import type { ReactFlowInstance } from '@xyflow/react'
import { describe, expect, it, vi } from 'vitest'
import type { CanvasSpatialIndex } from './utils/canvasSpatialIndex'
import { findConnectionPreviewTarget } from './ConnectionPreview'

describe('findConnectionPreviewTarget', () => {
  it('converts the 72px screen-space snap radius by zoom and excludes the source node', () => {
    const source = { id: 'source', type: 'card', position: { x: 0, y: 0 }, data: {} }
    const target = { id: 'target', type: 'card', position: { x: 100, y: 0 }, data: {} }
    const queryPoint = vi.fn(() => [
      { id: 'source', type: 'card', x: 0, y: 0, width: 100, height: 100, node: source },
      { id: 'target', type: 'card', x: 100, y: 0, width: 100, height: 100, node: target },
    ])
    const spatialIndex = { queryPoint } as unknown as CanvasSpatialIndex
    const reactFlowInstance = {
      screenToFlowPosition: vi.fn(() => ({ x: 60, y: 40 })),
    } as unknown as ReactFlowInstance

    const result = findConnectionPreviewTarget(
      spatialIndex,
      reactFlowInstance,
      { x: 120, y: 80 },
      'source',
      2,
    )

    expect(reactFlowInstance.screenToFlowPosition).toHaveBeenCalledWith({ x: 120, y: 80 })
    expect(queryPoint).toHaveBeenCalledWith({ x: 60, y: 40 }, 36)
    expect(result).toBe(target)
  })
})
