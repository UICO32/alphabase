import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import {
  createCanvasSpatialIndex,
  getNodeBoundsForIndex,
  isBoundsCenterInsideRect,
} from './canvasSpatialIndex'
import { COLLAPSED_CARD_HEIGHT } from '../../../types/card'

function node(partial: Partial<Node> & { id: string }): Node {
  return {
    id: partial.id,
    type: partial.type ?? 'card',
    position: partial.position ?? { x: 0, y: 0 },
    data: partial.data ?? {},
    width: partial.width,
    height: partial.height,
  } as Node
}

describe('canvasSpatialIndex', () => {
  it('computes card bounds from data width and height', () => {
    const bounds = getNodeBoundsForIndex(node({
      id: 'a',
      type: 'card',
      position: { x: 10, y: 20 },
      data: { width: 300, height: 180 },
    }))

    expect(bounds).toMatchObject({ id: 'a', type: 'card', x: 10, y: 20, width: 300, height: 180 })
  })

  it('uses collapsed card height when card data is collapsed', () => {
    const bounds = getNodeBoundsForIndex(node({
      id: 'a',
      type: 'card',
      position: { x: 0, y: 0 },
      data: { width: 300, height: 240, collapsed: true },
    }))

    expect(bounds.height).toBe(COLLAPSED_CARD_HEIGHT)
  })

  it('supports frame and media default bounds', () => {
    expect(getNodeBoundsForIndex(node({ id: 'frame', type: 'frame' })).width).toBe(600)
    expect(getNodeBoundsForIndex(node({ id: 'media', type: 'media' })).height).toBe(220)
  })

  it('returns only nodes intersecting a rectangle', () => {
    const index = createCanvasSpatialIndex([
      node({ id: 'a', position: { x: 0, y: 0 }, data: { width: 100, height: 100 } }),
      node({ id: 'b', position: { x: 500, y: 500 }, data: { width: 100, height: 100 } }),
      node({ id: 'c', position: { x: 80, y: 80 }, data: { width: 100, height: 100 } }),
    ])

    expect(index.queryRect({ x: -10, y: -10, width: 130, height: 130 }).map(n => n.id).sort()).toEqual(['a', 'c'])
  })

  it('returns nearby nodes around a point with radius', () => {
    const index = createCanvasSpatialIndex([
      node({ id: 'a', position: { x: 0, y: 0 }, data: { width: 100, height: 100 } }),
      node({ id: 'b', position: { x: 1000, y: 1000 }, data: { width: 100, height: 100 } }),
    ])

    expect(index.queryPoint({ x: 120, y: 50 }, 30).map(n => n.id)).toEqual(['a'])
  })

  it('lets callers filter nearby candidates by id and type', () => {
    const index = createCanvasSpatialIndex([
      node({ id: 'source', type: 'card', position: { x: 0, y: 0 }, data: { width: 100, height: 100 } }),
      node({ id: 'target', type: 'card', position: { x: 130, y: 0 }, data: { width: 100, height: 100 } }),
      node({ id: 'frame', type: 'frame', position: { x: 120, y: 0 }, data: { width: 200, height: 200 } }),
    ])

    const candidates = index
      .queryPoint({ x: 120, y: 50 }, 40)
      .filter(item => item.id !== 'source' && item.type === 'card')

    expect(candidates.map(item => item.id)).toEqual(['target'])
  })

  it('checks whether indexed bounds center is inside a rectangle', () => {
    const bounds = getNodeBoundsForIndex(node({
      id: 'a',
      type: 'card',
      position: { x: 100, y: 100 },
      data: { width: 100, height: 80 },
    }))

    expect(isBoundsCenterInsideRect(bounds, { x: 120, y: 120, width: 80, height: 80 })).toBe(true)
    expect(isBoundsCenterInsideRect(bounds, { x: 0, y: 0, width: 20, height: 20 })).toBe(false)
  })
})
