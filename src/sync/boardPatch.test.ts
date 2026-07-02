import { describe, expect, it } from 'vitest'
import { applyBoardPatches, type BoardPatch, type SerializableBoardData } from './boardPatch'

const base: SerializableBoardData = {
  nodes: [
    { id: 'a', type: 'card', position: { x: 0, y: 0 }, data: { cardId: 'a' }, width: 280, height: 200 },
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b', type: 'connection' },
  ],
}

describe('boardPatch', () => {
  it('updates a node by id', () => {
    const patches: BoardPatch[] = [
      { type: 'update-node', node: { id: 'a', type: 'card', position: { x: 10, y: 20 }, data: { cardId: 'a' }, width: 300, height: 220 } },
    ]

    expect(applyBoardPatches(base, patches).nodes[0]).toMatchObject({
      id: 'a',
      position: { x: 10, y: 20 },
      width: 300,
      height: 220,
    })
  })

  it('removes a node and connected edges', () => {
    const next = applyBoardPatches(base, [{ type: 'remove-node', nodeId: 'a' }])

    expect(next.nodes).toEqual([])
    expect(next.edges).toEqual([])
  })

  it('upserts and removes edges', () => {
    const added = applyBoardPatches(base, [
      { type: 'upsert-edge', edge: { id: 'e2', source: 'b', target: 'c', type: 'connection' } },
    ])
    expect(added.edges.map(e => e.id).sort()).toEqual(['e1', 'e2'])

    const removed = applyBoardPatches(added, [{ type: 'remove-edge', edgeId: 'e1' }])
    expect(removed.edges.map(e => e.id)).toEqual(['e2'])
  })
})
