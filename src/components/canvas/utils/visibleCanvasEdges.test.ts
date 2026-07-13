import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { getVisibleCanvasEdges } from './visibleCanvasEdges'

function frame(id: string, layout: string): Node {
  return {
    id,
    type: 'frame',
    position: { x: 0, y: 0 },
    data: { layout },
  }
}

function card(id: string, frameId?: string): Node {
  return {
    id,
    type: 'card',
    position: { x: 0, y: 0 },
    data: { cardId: id, color: 'white', frameId },
  }
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target }
}

describe('getVisibleCanvasEdges', () => {
  it('keeps all edges when no kanban frame exists', () => {
    const edges = [edge('e1', 'card-1', 'card-2')]
    expect(getVisibleCanvasEdges([
      frame('frame-1', 'free'),
      card('card-1', 'frame-1'),
      card('card-2', 'frame-1'),
    ], edges)).toBe(edges)
  })

  it('hides edges between cards inside the same kanban frame', () => {
    const visible = getVisibleCanvasEdges([
      frame('frame-1', 'kanban'),
      card('card-1', 'frame-1'),
      card('card-2', 'frame-1'),
      card('card-3'),
    ], [
      edge('inside', 'card-1', 'card-2'),
      edge('outside', 'card-1', 'card-3'),
    ])

    expect(visible.map(e => e.id)).toEqual(['outside'])
  })

  it('keeps edges between different kanban frames', () => {
    const visible = getVisibleCanvasEdges([
      frame('frame-1', 'kanban'),
      frame('frame-2', 'kanban'),
      card('card-1', 'frame-1'),
      card('card-2', 'frame-2'),
    ], [
      edge('cross-frame', 'card-1', 'card-2'),
    ])

    expect(visible.map(e => e.id)).toEqual(['cross-frame'])
  })
})
