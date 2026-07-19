import { Position, type Node, type ReactFlowInstance } from '@xyflow/react'
import { describe, expect, it, vi } from 'vitest'
import type { CanvasSpatialIndex } from './canvasSpatialIndex'
import { CONNECTION_SNAP_RADIUS, resolveConnectionSnap, resolveSourceEndpoint } from './connectionSnap'

describe('resolveConnectionSnap', () => {
  it('keeps the hit area at 72 screen pixels and returns deterministic preview geometry', () => {
    const source = {
      id: 'source',
      type: 'card',
      position: { x: 0, y: 0 },
      width: 100,
      height: 80,
      data: {},
    } as Node
    const target = {
      id: 'target',
      type: 'card',
      position: { x: 200, y: 20 },
      width: 120,
      height: 100,
      data: {},
    } as Node
    const queryPoint = vi.fn(() => [
      { id: target.id, type: target.type, x: 200, y: 20, width: 120, height: 100, node: target },
    ])
    const spatialIndex = { queryPoint } as unknown as CanvasSpatialIndex
    const reactFlow = {
      getNode: vi.fn((id: string) => id === source.id ? source : target),
      getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 2 })),
      screenToFlowPosition: vi.fn(() => ({ x: 195, y: 70 })),
      flowToScreenPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x: x * 2, y: y * 2 })),
    } as unknown as ReactFlowInstance

    const result = resolveConnectionSnap(
      spatialIndex,
      reactFlow,
      { x: 390, y: 140 },
      source.id,
    )

    expect(CONNECTION_SNAP_RADIUS).toBe(72)
    expect(queryPoint).toHaveBeenCalledWith({ x: 195, y: 70 }, 36)
    expect(result).toEqual({
      targetNodeId: target.id,
      sourceHandleId: 'right',
      targetHandleId: 'left-target',
      sourcePoint: { x: 200, y: 80 },
      targetPoint: { x: 400, y: 140 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    })
  })

  it('keeps the free preview anchored to the source edge before a target is found', () => {
    const source = {
      id: 'source',
      type: 'card',
      position: { x: 0, y: 0 },
      width: 100,
      height: 80,
      data: {},
    } as Node
    const reactFlow = {
      getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 2 })),
      flowToScreenPosition: vi.fn(() => ({ x: 0, y: 0 })),
    } as unknown as ReactFlowInstance

    expect(resolveSourceEndpoint(reactFlow, source, { x: 390, y: 140 })).toEqual({
      point: { x: 200, y: 80 },
      position: Position.Right,
    })
  })
})
